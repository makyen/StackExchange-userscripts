// ==UserScript==
// @name         SE: Dismiss New Follow Feature Popup On Active Sites
// @namespace    https://github.com/makyen/StackExchange-userscripts
// @version      1.1.0
// @description  Dismiss the popup notification of the new follow feature on all sites you have an account on.
// @author       Makyen
// @match        https://stackexchange.com/dismiss-follow-notification
// @require      https://github.com/SO-Close-Vote-Reviewers/UserScripts/raw/master/gm4-polyfill.js
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @run-at       document-idle
// @connect      stackexchange.com
// @connect      stackoverflow.com
// @connect      superuser.com
// @connect      serverfault.com
// @connect      askubuntu.com
// @connect      stackapps.com
// @connect      mathoverflow.net
// ==/UserScript==
/* globals */ // eslint-disable-line no-unused-vars, no-redeclare

//Once installed, navigate to
//  https://stackexchange.com/dismiss-follow-notification
//While on that page, the userscript will go through the sites on which you have accounts.
//Due to SE rate limiting, and to avoid the possibility of SE imposing a rate-limit block on your IP,
//the script waits 5 seconds between each site. Most SE sites have a Meta site, so, currently, that's
//up to 344 different sites, which will take up to 29 minutes.

(function() {
    'use strict';

    const SE_ACTION_DELAY = 5000;

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', afterLoaded);
    } else {
        afterLoaded();
    }

    function gmXmlHttpRequestAsPromise(details) {
        return new Promise((resolve, reject) => {
            ['onerror', 'ontimeout', 'onabort'].forEach((type) => {
                const origHandler = details[type];
                details[type] = function(response) {
                    if (typeof origHandler === 'function') {
                        origHandler(response);
                    }
                    //console.error('gmXmlHttpRequestAsPromise:', type, 'response:', response);
                    response.gmError = type;
                    reject(response);
                };
            });
            const origOnLoad = details.onload;
            function onload(response) {
                if (typeof origOnLoad === 'function') {
                    origOnLoad(response);
                }
                if (response.status !== 200) {
                    //console.error('gmXmlHttpRequestAsPromise: onload status !== 200: response:', response);
                    response.gmError = 'status !== 200';
                    reject(response);
                } else {
                    resolve(response);
                }
            }
            details.onload = onload;
            GM.xmlHttpRequest(details);
        });
    }

    function afterLoaded() {
        const parser = new DOMParser();
        let thens = Promise.resolve();
        const globalUID = document.querySelector('.my-profile').href.match(/\d+/)[0];
        const apiKey = 'C*zvUG9Jf22Qy7BZIsS9IQ((';

        function setFollowNoticeSeenFlagIgnoreErrors(url, fkey, userId) {
            return gmXmlHttpRequestAsPromise({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Origin': url,
                    'Referer': url + '/q/1',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                url: url + '/users/toggle-flag/512/true',
                data: `fkey=${fkey}&userId=${userId}`,
            }).then((followResponse) => {
                const status = followResponse.status === 200 && followResponse.response === '{"hasFlags":true}' ? 'success' : 'fail';
                console.log('Set follow notice seen for site:', url, 'status:', status);
                if (status !== 'success') {
                    console.log('followResponse:', followResponse);
                }
            }, (errorResponse) => {
                console.error('Failed to set follow notice seen for site:', url, 'errorResponse:', errorResponse);
                return Promise.resolve();
            });
        }

        function delay(time, delayedFunction) {
            //Return a Promise which is resolved after the specified delay and any specified function is called.
            //  Any additional arguments are passed to the delayedFunction and the return value from that function
            //  is what this Promise resolves as. This can chain an additional Promise.
            var mainArgs = arguments; //Needed due to a bug in a browser, I don't remember which one. See the GM4 polyfill merged PRs.
            return new Promise((resolve) => {
                setTimeout(() => {
                    if (typeof delayedFunction === 'function') {
                        //Using .slice(), or other Array methods, on arguments prevents optimization.
                        var args = [];
                        for (var index = 2; index < mainArgs.length; index++) {
                            args.push(mainArgs[index]);
                        }
                        resolve(delayedFunction.apply(null, args));
                    } else {
                        resolve();
                    }
                }, (time ? time : 0));
            });
        }

        const contentDiv = document.querySelector('.content-page.leftcol');
        function setProcessingDisplay(index, total, url) {
            contentDiv.textContent = `Processing ${index}/${total}: ${url.replace('https://', '')}`;
        }

        function getJSONAjax(url) {
            return gmXmlHttpRequestAsPromise({
                method: 'GET',
                url,
            }).then((response) => JSON.parse(response.responseText));
        }

        function getItemsFromHasMorePagesWithBackoff(baseUrl, startPage, endPage) {
            //This will return a Promise which resolves with the "items" from every page from an AJAX URL which implements
            //  a JSON response containing
            //  an array "items", and a "has_more" boolean property in the base Object. It also implements a backoff
            //  if the API response contains a "backoff" property with the number of seconds which need to be backed off.
            //  If endPage is not provided, or is -1, then all items from all pages until "has_more" is false will be returned.
            //  Given that this could be a huge number of pages, doing that should be only done with significant care.
            function getUrlWithPage(url, urlPage) {
                return `${url}&page=${urlPage}`;
            }

            startPage = typeof startPage === 'number' ? startPage : 1;
            endPage = typeof endPage === 'number' ? endPage : -1;
            let items = [];
            return new Promise((resolve, reject) => {
                function getItemsFromAPageAndContinue(page) {
                    //Should also handle running out of quota.
                    //Given that we are waiting to get the response from the previous page prior to requesting the next one,
                    //  it is assumed that takes long enough to prevent us from exceeding the 30 requests/s hard limit on the SE API.
                    getJSONAjax(getUrlWithPage(baseUrl, page))
                        .then((jsonResponse) => {
                            items = items.concat(jsonResponse.items || []);
                            if (jsonResponse.has_more && endPage > 0 && page < endPage) {
                                const backoff = jsonResponse.backoff ? jsonResponse.backoff * 1000 : 0;
                                setTimeout(getItemsFromAPageAndContinue, backoff, page + 1);
                            } else {
                                resolve(items);
                            }
                        }, (error) => {
                            //There is currently no actual error handling.
                            //We should handle at least some errors here, because the SE API can give an error instead of a backoff, particularly if
                            //  the endpoint is in use by something else on the same IP address.
                            //Pass the error on, but provide enough information such that the requests which succeeded are not wasted, and it's possible
                            // to recover from the error (i.e. could retry from the current state).
                            reject({// eslint-disable-line prefer-promise-reject-errors
                                error,
                                startPage,
                                endPage,
                                page,
                                items,
                            });
                        });
                }
                getItemsFromAPageAndContinue(startPage);
            });
        }

        //Get the list of sites on which the user has accounts.
        //Currently, 2020-03, there are < 180 SE sites, so we need, at most, 2 pages of 100.
        getItemsFromHasMorePagesWithBackoff(`https://api.stackexchange.com/2.2/users/${globalUID}/associated?pagesize=100&filter=!6PU2XEFMADgs1&key=${apiKey}`, 1, 10)
            .then((sites) => {
                let totalSites = sites.length;
                let siteProcessing = 0;
                sites.forEach(({user_id, site_url}) => {
                    //Convert the site URL to a URL for the site's Meta.
                    let metaSiteURL = site_url
                        .replace('.stackexchange', '.meta.stackexchange')
                        .replace('stackoverflow', 'meta.stackoverflow')
                        .replace('superuser', 'meta.superuser')
                        .replace('serverfault', 'meta.serverfault')
                        .replace('mathoverflow', 'meta.mathoverflow')
                        .replace('askubuntu', 'meta.askubuntu');
                    if (metaSiteURL === site_url || site_url === 'https://meta.stackexchange.com') {
                        metaSiteURL = '';
                    }
                    if (metaSiteURL) {
                        totalSites++;
                    }
                    //Add this site and its Meta, if there is one, to the Promise chain.
                    thens = thens.then(() => {
                        siteProcessing++;
                        setProcessingDisplay(siteProcessing, totalSites, site_url);
                        //The fkey is not the same on all sites. Thus, to be sure, we get the fkey for each site.
                        return gmXmlHttpRequestAsPromise({
                            method: 'GET',
                            url: site_url,
                        }).then((siteResponse) => {
                            //Use the browser to parse the site's HTML.
                            const siteAsDOM = parser.parseFromString(siteResponse.responseText, 'text/html');
                            const siteFkey = siteAsDOM.querySelector('input[name="fkey"]').value;
                            //We now have all the information we need in order to send the POST to the site and its Meta.
                            return setFollowNoticeSeenFlagIgnoreErrors(site_url, siteFkey, user_id)
                                .then(() => {
                                    if (metaSiteURL) {
                                        return delay(SE_ACTION_DELAY).then(() => {
                                            siteProcessing++;
                                            setProcessingDisplay(siteProcessing, totalSites, metaSiteURL);
                                            setFollowNoticeSeenFlagIgnoreErrors(metaSiteURL, siteFkey, user_id);
                                        });
                                    }
                                }, () => delay(SE_ACTION_DELAY)) //Ignore errors and continue.
                                //In order to avoid SE rate limiting, or a rate violation ban, delay 5s between each site.
                                .then(() => delay(SE_ACTION_DELAY));
                        });
                    });
                });
                //All sites are now in the Promise chain. Update the display after everything is done.
                thens = thens.then(() => {
                    setProcessingDisplay(siteProcessing, totalSites, 'ALL DONE');
                });
            });
    }
})();
