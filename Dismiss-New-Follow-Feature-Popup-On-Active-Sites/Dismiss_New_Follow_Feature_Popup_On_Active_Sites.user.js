// ==UserScript==
// @name         SE: Dismiss New Follow Feature Popup On Active Sites
// @namespace    https://github.com/makyen/StackExchange-userscripts
// @version      1.0.0
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
/* globals $ */ // eslint-disable-line no-unused-vars, no-redeclare

//Once installed, navigate to
//  https://stackexchange.com/dismiss-follow-notification
//While on that page, the userscript will go through the sites on which you have accounts.
//Due to SE rate limiting, and to avoid the possibility of SE imposing a rate-limit block on your IP,
//the script waits 5 seconds between each site. Most SE sites have a Meta site, so, currently, that's
//up to 344 different sites, which will take up to 29 minutes.

(function() {
    'use strict';
    const contentDiv = $('.content-page.leftcol');

    function setFollowNoticeSeenFlagIgnoreErrors(url, fkey, userId) {
        return GM.xmlHttpRequest({
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Origin': url,
                'Referer': url + '/q/1',
                'X-Requested-With': 'XMLHttpRequest',
            },
            url: url + '/users/toggle-flag/512/true',
            data: `fkey=${fkey}&userId=${userId}`,
        }).then(function(followResponse) {
            const status = followResponse.status === 200 && followResponse.response === '{"hasFlags":true}' ? 'success' : 'fail';
            console.log('Set follow notice seen for site:', url, 'status:', status);
            if (status !== 'success') {
                console.log('response arguments:', arguments);
            }
        }, () => {
            console.error('Failed to set follow notice seen for site:', url, 'response arguments:', arguments);
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

    function setProcessingDisplay(index, total, url) {
        contentDiv.text(`Processing ${index}/${total}: ${url.replace('https://', '')}`);
    }

    const parser = new DOMParser();
    let sites = [];
    let thens = Promise.resolve();
    const globalUID = $('.my-profile')[0].href.match(/\d+/)[0];
    const apiKey = 'C*zvUG9Jf22Qy7BZIsS9IQ((';
    //Get the list of sites on which the user has accounts.
    //Currently, 2020-03, there are < 180 SE sites, so we need, at most, 2 pages of 100.
    $.get(`https://api.stackexchange.com/2.2/users/${globalUID}/associated?pagesize=100&filter=!6PU2XEFMADgs1&key=${apiKey}&page=1`)
        .always((response) => {
            sites = sites.concat(response.items || []);
        })
        .always(() => {
            $.get(`https://api.stackexchange.com/2.2/users/${globalUID}/associated?pagesize=100&filter=!6PU2XEFMADgs1&key=${apiKey}&page=2`)
                .always((response2) => {
                    sites = sites.concat(response2.items || []);
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
                            return GM.xmlHttpRequest({
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
                                            return delay(5000).then(() => {
                                                siteProcessing++;
                                                setProcessingDisplay(siteProcessing, totalSites, metaSiteURL);
                                                setFollowNoticeSeenFlagIgnoreErrors(metaSiteURL, siteFkey, user_id);
                                            });
                                        }
                                    })
                                    //In order to avoid SE rate limiting, or a rate violation ban, delay 5s between each site.
                                    .then(() => delay(5000));
                            });
                        });
                    });
                    //All sites are now in the Promise chain. Update the display after everything is done.
                    thens = thens.then(() => {
                        setProcessingDisplay(siteProcessing, totalSites, 'ALL DONE');
                    });
                });
        });
})();
