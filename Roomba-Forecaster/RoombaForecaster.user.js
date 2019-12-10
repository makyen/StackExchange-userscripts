// ==UserScript==
// @name         Roomba Forecaster
// @author       Makyen
// @author       Siguza
// @version      2.2.3
// @description  Is Roomba going to delete the question? If not, why? If so, when?
// @namespace    makyen-RoombaForecaster
// @homepage     https://github.com/makyen/StackExchange-userscripts/tree/master/Roomba-Forecaster
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @require      https://github.com/SO-Close-Vote-Reviewers/UserScripts/raw/master/gm4-polyfill.js
// @include      /^https?://([^/]*\.)?stackoverflow\.com/(?:q(uestions)?/\d|review/close(?:/\d|/?$)|review/MagicTagReview).*$/
// @include      /^https?://([^/]*\.)?serverfault\.com/(?:q(uestions)?/\d|review/close(?:/\d|/?$)|review/MagicTagReview).*$/
// @include      /^https?://([^/]*\.)?superuser\.com/(?:q(uestions)?/\d|review/close(?:/\d|/?$)|review/MagicTagReview).*$/
// @include      /^https?://([^/]*\.)?stackexchange\.com/(?:q(uestions)?/\d|review/close(?:/\d|/?$)|review/MagicTagReview).*$/
// @include      /^https?://([^/]*\.)?askubuntu\.com/(?:q(uestions)?/\d|review/close(?:/\d|/?$)|review/MagicTagReview).*$/
// @include      /^https?://([^/]*\.)?stackapps\.com/(?:q(uestions)?/\d|review/close(?:/\d|/?$)|review/MagicTagReview).*$/
// @include      /^https?://([^/]*\.)?mathoverflow\.net/(?:q(uestions)?/\d|review/close(?:/\d|/?$)|review/MagicTagReview).*$/
// ==/UserScript==
/* globals StackExchange */

/*This is a fork of "Roombaforecast" by Siguza, which can be obtained from:
 *  https://github.com/Siguza/StackScripts/blob/master/RoombaForecast.user.js
 *  The portions of code retained from that source are:
 *    XHR()
 *    Portions of getQuestionId()
 *    Portions of addRoombaField()
 *    Most of the lines invoking the above functions.
 *    Some of the lines in the ==UserScript== block.
 *  All code from the above source has been released to the public domain. There
 *  may  be some which is not listed above, but a reasonable effort has been made to
 *  list all the code which was retained.
 */

/*The remainder of this code is released under the MIT license.
 *  You can see a copy of the license at:
 *    https://github.com/makyen/StackExchange-userscripts/blob/master/LICENSE.md
 */

/* Set config.scrapePage to false to use the API instead of scraping the page.
 *   * Scraping is faster than the API.
 *   * Scraping doesn't consume any of the API request quota, which may be of value to
 *       power users.
 * Scraping was implemented prior to determining that this would be a separate project,
 * rather than pulled back into Roombaforecast, which does not have an API key.  Thus, at the
 * time the scraping capability was written, no API key existed for this script which
 * limited it to a max of 300 requests/IP/day.  Scraping/API use can now be set through the
 * options UI by opening it using Shift, Ctrl, or Alt when clicking on the "roomba" status
 * line.
 */

(function() {
    'use strict';

    //Config defaults
    var config = {
        scrapePage: true,               //Scrape the page instead of using the SE API.
        //Control what is displayed. Some combinations don't make much sense.
        showShortRoombaStatus: true,    //Show/not show the entire "roomba" line under "viewed".
        useTooltip: true,               //Put the larger Roomba table in a tooltip.
        showShortReasons: false,        //Show a short version of the reasons for "roomba No".
        showIfDownvoteWillRoomba: true, //Show if a downvote is enough to qualify for Roomba.
        alwaysShowRoombaTable: false,   //If !useToolTip controls display of larger Roomba table
    };

    /* The following code for detecting browsers is from my answer at:
     *   http://stackoverflow.com/a/41820692/3773011
     *   which is based on code from:
     *   http://stackoverflow.com/a/9851769/3773011
     */
    //Opera 8.0+ (tested on Opera 42.0)
    const isOpera = (!!window.opr && !!window.opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
    //Firefox 1.0+ (tested on Firefox 45 - 53)
    const isFirefox = typeof InstallTrigger !== 'undefined';
    //Internet Explorer 6-11
    //   Untested on IE (of course). Here because it shows some logic for isEdge.
    const isIE = /*@cc_on!@*/false || !!document.documentMode;
    //Edge 20+ (tested on Edge 38.14393.0.0)
    const isEdge = !isIE && !!window.StyleMedia;
    //The other browsers are trying to be more like Chrome, so picking
    //  capabilities which are in Chrome, but not in others, is a moving
    //  target.  Just default to Chrome if none of the others is detected.
    const isChrome = !isOpera && !isFirefox && !isIE && !isEdge;
    // Blink engine detection (tested on Chrome 55.0.2883.87 and Opera 42.0)
    const isBlink = (isChrome || isOpera) && !!window.CSS;

    const configKeys = Object.keys(config);
    const isCloseReview = window.location.pathname.indexOf('/review/close/') === 0 || window.location.pathname === '/review/close';
    const isMagicTag = window.location.pathname.indexOf('/review/MagicTagReview') === 0;
    const isMeta = /(?:^|\.)meta\./.test(window.location.hostname);
    const beforeRoombaTableSelector = '#question-header + div.grid, #qinfo, .reviewable-post-stats > table, .review-task .review-sidebar .review-information';
    const sidebarSelector = '#sidebar, .sidebar, .review-task .review-sidebar';
    const sitesMustUseAPI = [].concat.apply([], [
        'pt.stackoverflow.com',
        'es.stackoverflow.com',
        'ru.stackoverflow.com',
        'ja.stackoverflow.com',
        'rus.stackexchange.com',
    ].map((site) => [site, site.replace(/\./, '.meta.')]));
    let mustUseAPI = sitesMustUseAPI.indexOf(window.location.hostname) > -1 || isCloseReview;
    let isViewsBelowTitle = false;
    var configSaveWorking = true;
    restoreConfig().then(afterRestoreConfig, afterRestoreConfig);

    function getElementContainingRoombaTable() {
        return asArray(document.querySelectorAll(beforeRoombaTableSelector)).filter((element) => element.children.length > 0)[0];
    }

    function afterRestoreConfig() {
        rationalizeConfig();

        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', setup);
        } else {
            setup();
        }
    }

    function setup() {
        function delayUpdateRoomba() {
            //Allow some time for the API to process the vote.
            setTimeout(addOrUpdateRoomba, (config.scrapePage && !mustUseAPI) ? 250 : 2000);
        }

        function updateRoombaIfClickIsVote(event) {
            var target = event.target;
            if (target.classList.contains('js-vote-up-btn') || target.classList.contains('js-vote-down-btn')) {
                delayUpdateRoomba();
            }
        }

        function inPageDetectAjaxComplete() {
            var ajaxCompleteTimer;
            //Global jQuery AJAX listener: Catches user moving to the next review.
            $(document).ajaxComplete(function(event, jqXHR, ajaxSettings) {
                //Debounce the detection of AJAX calls, as there are sometimes several at one time.
                clearTimeout(ajaxCompleteTimer);
                ajaxCompleteTimer = setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('roombaForecaster-jQueryAJAX-complete', {
                        bubbles: true,
                        cancelable: true,
                        detail: ajaxSettings.url,
                    }));
                }, 500);
            });
        }

        function addRoombaIfNone() {
            if (!document.getElementById('roombaFieldRow')) {
                if (isMagicTag) {
                    //If this is a version of MagicTag that doesn't show answers, then we need to use the API.
                    mustUseAPI = document.querySelector('.review-answers') ? mustUseAPI : false;
                    addOrUpdateRoomba();
                    addVoteEvents();
                } else {
                    addOrUpdateRoomba();
                }
            }
        }

        function addVoteEvents() {
            //Update the roomba if the user clicks on a question vote.
            try {
                //There are only two possible question votes so put the event listener directly on those.
                document.querySelector('#question .js-vote-up-btn').addEventListener('click', delayUpdateRoomba);
                document.querySelector('#question .js-vote-down-btn').addEventListener('click', delayUpdateRoomba);
                //Update the roomba if the user clicks on an answer vote.
                document.querySelector('#answers').addEventListener('click', updateRoombaIfClickIsVote);
            } catch (e) {
                //Ignore errors. We would get errors here when the question is locked.
            }
        }

        function mainAjaxEventReceived(event) {
            const url = event.detail;
            if (/realtime/.test(url)) {
                if (config.scrapePage && !mustUseAPI) {
                    //Don't update if the source is the API
                    addOrUpdateRoomba();
                    addVoteEvents();
                }
            }
        }

        let observerReaddRFTimeout;

        function underTitleObserver(mutations, observer) {
            const firstQinfoCell = document.querySelector('#question-header + div.grid > .grid--cell');
            if (!firstQinfoCell) {
                isViewsBelowTitle = false;
                observer.disconnect();
                clearTimeout(observerReaddRFTimeout);
                observerReaddRFTimeout = setTimeout(addRoombaIfNone, 50);
            }
        }

        if (isCloseReview) {
            executeInPage(inPageDetectAjaxComplete, true, 'roombaForecaster-AJAX-listener');
            //In the Close Vote Review Queue we must use the SE API, so only add it, don't update.
            window.addEventListener('roombaForecaster-jQueryAJAX-complete', addRoombaIfNone);
        }

        if (isMagicTag) {
            window.addEventListener('magicTagReview-questionFullyDisplayed', () => {
                //Delay until after MagicTag processing. Could actually watch for the specific changes,
                //  but this is sufficient, if potentially delayed slightly.
                setTimeout(addRoombaIfNone, 100);
                setTimeout(addRoombaIfNone, 1000);
            });
        }

        if (!document.getElementById('qinfo')) {
            //Either this is the new SE HTML as of 2019-07-25, or we need to exit.
            const underTitleContainer = document.querySelector('#question-header + div.grid');
            if (underTitleContainer) {
                //Looks like it's the new HTML (2019-07-25)
                isViewsBelowTitle = true;
                new MutationObserver(underTitleObserver).observe(underTitleContainer.parentNode, {childList: true});
                new MutationObserver(underTitleObserver).observe(underTitleContainer, {childList: true});
            } else {
                // Exit.  Don't setup the Roomba Forecaster.  We've already setup the
                // non-question pages which are special cases.  For everything after this we're
                // looking for the structure we'd normally find in a question page. The page does
                // not have the question info table into which a line is to be placed.
                // Generally, the issue of executing on a page where the table does not exist
                // should be solved by changing the @includes so the page does not qualify.
                // But, this will catch any that were erroneously included.  In addition, this
                // should handle an issue in Edge where the script is executed a second time, in
                // a new scope, on the same page, but in an environment where the DOM is
                // corrupted.
                return;
            }
        }

        detectAndRemoveRoombaForecastChanges();
        //Add the Roomba display
        addOrUpdateRoomba();
        addVoteEvents();
        //This isn't going to work, unless it's limited to a subset of all AJAX calls.
        executeInPage(inPageDetectAjaxComplete, true, 'roombaForecaster-AJAX-listener');
        window.addEventListener('roombaForecaster-jQueryAJAX-complete', mainAjaxEventReceived);
    }

    function inPageNotify(message) {
        function notifyIfSEExists() {
            if (typeof StackExchange === 'object' && StackExchange.notify && typeof StackExchange.notify.show === 'function') {
                StackExchange.notify.show(message, Date.now());
            } else {
                setTimeout(notifyIfSEExists, 1000);
            }
        }
        notifyIfSEExists();
    }

    function saveConfig() {
        return GM.setValue('config', JSON.stringify(config)).catch((e) => {
            console.error(e);
            configSaveWorking = false;
        });
    }

    function restoreConfig() {
        let storedConfig = JSON.stringify({});
        return GM.getValue('config', storedConfig).then((inStorage) => {
            storedConfig = JSON.parse(inStorage);
            Object.keys(storedConfig).forEach(function(key) {
                config[key] = storedConfig[key];
            });
            if (!config.disabledScraping201910) {
                config.disabledScraping201910OriginalScrapePage = config.scrapePage;
                config.disabledScraping201910 = true;
                if (config.scrapePage) {
                    //Currently, set to scrape pages, which was the default.
                    //  Set to use the API and notify the user.
                    config.scrapePage = false;
                    const message = 'Roomba Forecaster is now fetching data from the SE API on question pages. Once the changes SE is making to question status banners are complete for all sites, it\'s expected to return to scraping question pages for the data it needs.';
                    executeInPage(inPageNotify, true, `RoombaForecaster-notify-${Date.now()}`, message);
                }
                return saveConfig();
            }
        }).catch((e) => {
            console.error(e);
            configSaveWorking = false;
        });
    }

    function rationalizeConfigLikeObject(obj) {
        if (!obj.alwaysShowRoombaTable && !obj.showShortRoombaStatus) {
            //If both of these are false, then there is no display.
            obj.showShortRoombaStatus = true;
        }
        if (!obj.showShortRoombaStatus && obj.useTooltip) {
            //Can't use tooltip if not showing the short status.
            obj.useTooltip = false;
        }
        //Force using the SE API, as we don't understand the new version of the page with different close banner on 50% of SO.
        obj.scrapePage = false;
    }

    function rationalizeConfig() {
        rationalizeConfigLikeObject(config);
    }

    /* Not used
    function logConfig() {
        configKeys.forEach(function(key) {
            console.log(key + ':', config[key]);
        });
    }
    */

    function detectAndRemoveRoombaForecastChanges(last) {
        //Prevent there from being two "roomba" lines if both this script and
        // RoombaForecast are installed.
        var table = getElementContainingRoombaTable();
        //loop through the table cells not added by this script looking for 'roomba'
        if (!asArray(table.querySelectorAll('td:not(#roombaFieldRowLabel)')).some(function(cell) {
            if (cell.textContent === 'roomba') {
                //found a roomba row
                cell.parentNode.parentNode.removeChild(cell.parentNode);
                return true;
            }
            return false;
        })) {
            //Did not find a roomba row. It may not have been created yet.
            if (!last) {
                //Look again after letting other JavaScript run (e.g. the RoombaForecast).
                setTimeout(detectAndRemoveRoombaForecastChanges, 0, true);
            }
        }
    }

    function asArray(obj) {
        //Accepts Arrays, array-like Objects (e.g. NodeLists), single elements, primitives.
        //  Returns an array, even if the array only has one entry.
        if (typeof obj !== 'object' || obj instanceof Node) {
            return [obj];
        }
        if (Array.isArray(obj)) {
            return obj;
        }
        if (obj === null) {
            return null;
        }
        var newArr;
        if (typeof obj.length === 'number') {
            //NodeList and other array-like objects: faster in all tested browsers and
            //  more compatible than Array.from().
            if (isChrome || isOpera || isBlink) {
                const length = obj.length;
                newArr = new Array(length);
                for (var i = 0; i < length; i++) {
                    newArr[i] = obj[i];
                }
                return newArr;
            } //else
            //Fastest in Firefox, IE11, and Edge. Used as default for non-Blink engines
            newArr = [];
            newArr.push.apply(newArr, obj);
            return newArr;
        }
        if (typeof obj.nextNode === 'function') {
            //e.g. TreeWalkers, NodeIterator
            newArr = [];
            var currentNode;
            while (currentNode = obj.nextNode()) { // eslint-disable-line no-cond-assign
                newArr.push(currentNode);
            }
            return newArr;
        }
        if (typeof Array.from === 'function') {
            return Array.from(obj);
        }
        //Indicate that we don't know what to do with the Object
        return null;
    }

    /*Copied from various other scripts of mine*/
    function executeInPage(functionToRunInPage, leaveInPage, id) {
        //Execute a function in the page context.
        // Any additional arguments passed to this function are passed into the page to the
        // functionToRunInPage.
        // Such arguments must be Object, Array, functions, RegExp,
        // Date, and/or other primitives (Boolean, null, undefined,
        // Number, String, but not Symbol).  Circular references are
        // not supported. Prototypes are not copied.
        // Using () => doesn't set arguments, so can't use it to define this function.
        // This has to be done without jQuery, as jQuery creates the script
        // within this context, not the page context, which results in
        // permission denied to run the function.
        function convertToText(args) {
            //This uses the fact that the arguments are converted to text which is
            //  interpreted within a <script>. That means we can create other types of
            //  objects by recreating their normal JavaScript representation.
            //  It's actually easier to do this without JSON.stringify() for the whole
            //  Object/Array.
            var asText = '';
            var level = 0;

            function lineSeparator(adj, isntLast) {
                level += adj - ((typeof isntLast === 'undefined' || isntLast) ? 0 : 1);
                asText += (isntLast ? ',' : '') + '\n' + (new Array((level * 2) + 1)).join('');
            }

            function recurseObject(obj) {
                if (Array.isArray(obj)) {
                    asText += '[';
                    lineSeparator(1);
                    obj.forEach(function(value, index, array) {
                        recurseObject(value);
                        lineSeparator(0, index !== array.length - 1);
                    });
                    asText += ']';
                } else if (obj === null) {
                    asText += 'null';
                } else if (obj === void (0)) {
                    //undefined
                    asText += 'void(0)';
                } else if (Number.isNaN(obj)) {
                    //Special cases for Number
                    //Not a Number (NaN)
                    asText += 'Number.NaN';
                } else if (obj === 1 / 0) {
                    // +Infinity
                    asText += '1/0';
                } else if (obj === 1 / -0) {
                    // -Infinity
                    asText += '1/-0';
                } else if (obj instanceof RegExp || typeof obj === 'function') {
                    //function
                    asText += obj.toString();
                } else if (obj instanceof Date) {
                    asText += 'new Date("' + obj.toJSON() + '")';
                } else if (typeof obj === 'object') {
                    asText += '{';
                    lineSeparator(1);
                    Object.keys(obj).forEach(function(prop, index, array) {
                        asText += JSON.stringify(prop) + ': ';
                        recurseObject(obj[prop]);
                        lineSeparator(0, index !== array.length - 1);
                    });
                    asText += '}';
                } else if (['boolean', 'number', 'string'].indexOf(typeof obj) > -1) {
                    asText += JSON.stringify(obj);
                } else {
                    console.log('Didn\'t handle: typeof obj:', typeof obj, '::  obj:', obj);
                }
            }
            recurseObject(args);
            return asText;
        }
        var newScript = document.createElement('script');
        if (typeof id === 'string' && id) {
            newScript.id = id;
        }
        var args = [];
        //Using .slice(), or other Array methods, on arguments prevents optimization.
        for (var index = 3; index < arguments.length; index++) {
            args.push(arguments[index]);
        }
        newScript.textContent = '(' + functionToRunInPage.toString() + ').apply(null,' +
            convertToText(args) + ');';
        (document.head || document.documentElement).appendChild(newScript);
        if (!leaveInPage) {
            //Synchronous scripts are executed immediately and can be immediately removed.
            //Scripts with asynchronous functionality *may* need to remain in the page
            //  until complete. Exactly what's needed depends on actual usage.
            document.head.removeChild(newScript);
        }
        return newScript;
    }

    function addOrUpdateRoomba() {
        const FILTER_ID = '!b0OfMvgVcFN2Ro'; //Default + comment_count + reopen_vote_count + answers + close details
        const API_KEY = 'ZCNbdLB0bpKnf4EjSy8bdQ((';
        const SECONDS_IN_DAY = 86400;
        //const DOWNVOTE_QUALIFIES_NONE = 0x0;
        const DOWNVOTE_QUALIFIES_QUESTION = 0x1;
        const DOWNVOTE_QUALIFIES_ANSWER = 0x2;

        var getRequestJson = (config.scrapePage && !mustUseAPI) ? fakeAPIByScraping : XHR;

        //Define the Roombas
        var roombas = [];

        function RoombaQualifier(_properties) { //RoobaQualifier class
            this.reasons = [];
            this.shortReasons = [];
            this.remainingDays = 9999; //Just a large number > 999.
            this.html = '';
            this.shortHtml = '';
            Object.assign(this, _properties);
        }

        roombas.push(new RoombaQualifier({
            //Closed, 9 days   (Daily)                           [RemoveAbandonedClosed]
            headerText: 'Closed&nbsp;>9&nbsp;Days',
            headerTextShort: 'Closed&nbsp;>9&nbsp;D',
            shortReasonPrefix: 'Cl',
            downvoteText: '(closed)',
            frequency: 'daily',
            criteria: {
                maxScore: 0,
                isLocked: false,
                maxAnswerScore: 0,
                isClosed: true,
                isDuplicate: false,
                hasAcceptedAnswer: false,
                hasReopenVotes: false,
                time: {
                    daysDelayFromEdit: 9,
                    daysDelayFromClose: 9,
                    daysOffsetFromReportedCloseToClose: 2, //Basically, a fudge factor based on observed behavior of hold to delete date.
                },
            },
        }));
        roombas.push(new RoombaQualifier({
            // > 30 days old   (Weekly)                          [RemoveDeadQuestions]
            headerText: '>&nbsp;30&nbsp;Days',
            headerTextShort: '>&nbsp;30&nbsp;Days',
            shortReasonPrefix: '30',
            downvoteText: '(30-day)',
            frequency: 'weekly',
            criteria: {
                isLocked: false,
                maxScore: -1,
                maxAnswers: 0,
                time: {
                    age: 30,
                },
            },
            overrides: {
                closedAndMigratedAway: true, //                  [RemoveMigrationStubs]
                migratedHereAndRejected: true, //                 [RemoveRejectedMigrations]
            },
        }));
        roombas.push(new RoombaQualifier({
            // > 365 days old  (Weekly)                          [RemoveAbandonedQuestions]
            headerText: '>&nbsp;365&nbsp;Days',
            headerTextShort: '>&nbsp;365&nbsp;Days',
            shortReasonPrefix: '365',
            downvoteText: '(365-day)',
            frequency: 'weekly',
            criteria: {
                isLocked: false,
                maxScore: 0, //While stated as === not <=, < is covered by 30 day
                maxScoreOwnerDeleted: 1, //Questions from deleted users don't get deleted if score === 0.
                maxAnswers: 0,
                ageToViewMultiplier: 1.5,
                maxComments: 1,
                isMeta: false,
                time: {
                    age: 365,
                },
            },
        }));

        function XHR(type, url, data, callback) {
            var xhr = new XMLHttpRequest();
            xhr.open(type, url);
            xhr.addEventListener('load', function(ev) {
                if (xhr.status !== 200) {
                    //If there is a non- 200 status returned, log the response.
                    console.log('Error in response to SE API call: status,', xhr.status, ':: statusText,', xhr.statusText, ':: responseText:', xhr.responseText);
                    console.log('Using Scraping:');
                    fakeAPIByScraping(type, url, data, callback);
                    return;
                }
                if (typeof callback === 'function') {
                    callback(ev.target.response);
                }
            });
            xhr.addEventListener('error', function(ev) {
                console.error(ev);
            });
            xhr.send(data);
        }

        function getQuestionId() {
            let question;
            if (isCloseReview) {
                question = document.querySelector('.question');
            } else {
                question = document.getElementById('question');
            }
            return question ? question.dataset.questionid : null;
        }

        function fakeAPIByScraping(type, url, data, callback) {
            function findElementWithMatchingText(query, text) {
                //Get the first element matching the query which also contains the text or RegEx.
                return asArray(document.querySelectorAll(query)).find(function(el) {
                    return el.textContent.search(text) > -1;
                });
            }

            function findElementWithMatchingTextInTooltip(query, text) {
                //Get the first element matching the query which also contains the text or RegEx.
                return asArray(document.querySelectorAll(query)).find(function(el) {
                    return el.title.search(text) > -1;
                });
            }

            function getRestOfTextWithMatchingText(query, text) {
                //Get the remaining text from the first element that matches both the query
                //  and the specified text/RegEx once the matching text has been removed.
                var found = findElementWithMatchingText(query, text);
                if (found) {
                    return found.textContent.replace(text, '').trim();
                } //else
                return '';
            }

            function elementTooltipTextAsDateSeconds(el) {
                //Convert the date contained in a 'title' attribute tooltip into
                //  the seconds from the epoch.
                var text = '';
                if (el) {
                    text = el.getAttribute('title');
                }
                if (text) {
                    return Date.parse(text.replace(' ', 'T')) / 1000;
                } //else
                return '';
            }

            function getApproximateNumberFromSimplifiedNumberText(text) {
                text = text.trim();
                let multiplier = 1;
                multiplier = text.endsWith('k') || text.endsWith('K') ? 1000 : multiplier;
                multiplier = text.endsWith('m') || text.endsWith('M') ? 1000000 : multiplier;
                multiplier = text.endsWith('g') || text.endsWith('G') ? 1000000000 : multiplier;
                text = text.replace(/[kmg]/, '');
                return +text * multiplier;
            }

            function getQuestionDataFromPage() {
                //Scraping the page for question information.
                //  Matches the JSON returned by the API for the data which is used by Roomba Forecaster.
                var question = {
                    score: +document.querySelector('#question .votecell .js-vote-count').textContent,
                    creation_date: elementTooltipTextAsDateSeconds(document.querySelector('#question .post-signature.owner .relativetime')),
                    owner: {
                        user_type: document.querySelector('#question .owner .user-details a') ? 'valid' : 'does_not_exist', // 'does_not_exist' if not exist
                    },
                    view_count: +getRestOfTextWithMatchingText('#qinfo p.label-key', 'times'),
                    comment_count: document.querySelectorAll('#question .comment').length,
                    reopen_vote_count: 0,
                    answer_count: 0,
                    is_answered: false,
                    //The following properties only exist if valid. Thus, they are handled outside the initializer.
                    //last_edit_date:,
                    //answers:[], //List of answers each needs score
                    //accepted_answer_id:, //Only existence is tested.
                    //closed_date:null,
                    //closed_reason:null,
                    //locked_date:null
                    //migrated_from
                    //migrated_to
                };
                //views, in tooltip available from under the question title as of 2019-07-26/7.
                const viewSelector = isViewsBelowTitle ? '#question-header + div.grid > .grid--cell' : '#qinfo p.label-key';
                if (!question.view_count) {
                    question.view_count = +findElementWithMatchingTextInTooltip(viewSelector, 'times').title.replace(/(?:viewed|times|[,.\s])/ig, '');
                }
                //views, if the text is the simplified number used under the question title as of 2019-07-25.
                if (!question.view_count) {
                    question.view_count = getApproximateNumberFromSimplifiedNumberText(getRestOfTextWithMatchingText(viewSelector, 'times').replace(/viewed/i, '').trim());
                }
                //last_edit_date
                var lastEditDateEl = document.querySelector('#question .post-signature:not(.owner) div.user-action-time .relativetime');
                if (lastEditDateEl) {
                    question.last_edit_date = elementTooltipTextAsDateSeconds(lastEditDateEl);
                }
                //answers
                //  This assumes that if there are any positive scoring answers they are visible on this page. There is an unlikely case
                //  where the user is showing Answers by oldest first and there are enough old, down-voted answers to fill the first
                //  page of answers.
                var answers = [];
                asArray(document.querySelectorAll('#answers div.answer:not(.deleted-answer) .js-vote-count')).forEach(function(el) {
                    answers.push({score: el.textContent});
                });
                if (answers.length > 0) {
                    question.answers = answers;
                    question.answer_count = answers.length;
                    question.is_answered = true;
                }
                //accepted
                var acceptedAnswer = document.querySelector('#answers div.accepted-answer');
                if (acceptedAnswer) {
                    question.accepted_answer_id = +acceptedAnswer.dataset.answerid;
                }
                //closed/duplicate/locked
                var statusTextEls = asArray(document.querySelectorAll('#question .special-status .question-status H2 B'));
                var isDeleted = false;
                statusTextEls.forEach(function(el) {
                    //There is a special status with at least one entry
                    var statusText = el.textContent;
                    if (statusText.search(/hold|closed|marked/i) > -1) {
                        //Question is closed, or on hold. API values do not distinguish.
                        question.closed_reason = el.nextSibling.textContent.replace(/^\s*as\s+/, '').replace(/\s+by\s*$/, '');
                        if (statusText.search(/marked/i) > -1) {
                            question.closed_reason = 'duplicate';
                        }
                        question.closed_date = elementTooltipTextAsDateSeconds(el.parentNode.parentNode.querySelector('span.relativetime'));
                    } else if (statusText.search(/locked/i) > -1) {
                        //Question is locked.
                        question.locked_date = elementTooltipTextAsDateSeconds(el.parentNode.parentNode.querySelector('span.relativetime'));
                    } else if (statusText.search(/migrated|migration\s*rejected/i) > -1) {
                        //The question was migrated.
                        //Tested on https://stackoverflow.com/questions/56933578/stata-keeping-observations-under-many-criteria-when-they-appear-in-more-than prior to deletion.
                        var migratedFromTo = 'migrated_to';
                        if (el.parentNode.textContent.search(/migrated\s*from|migration\s*rejected\s*from/i) > -1) {
                            migratedFromTo = 'migrated_from';
                        }
                        question[migratedFromTo] = {
                            on_date: elementTooltipTextAsDateSeconds(el.parentNode.parentNode.querySelector('span.relativetime')),
                        };
                        if (statusText.search(/migration\s*rejected/i) > -1) {
                            //Question is also locked, but there's no banner that says so.
                            question.locked_date = elementTooltipTextAsDateSeconds(el.parentNode.parentNode.querySelector('span.relativetime'));
                        }
                    } else if (statusText.search(/deleted/i) > -1) {
                        isDeleted = true;
                    }
                });
                //reopen_vote_count
                var reopenEl = document.querySelector('#question .close-question-link');
                if (reopenEl) {
                    var reopenCountEl = reopenEl.querySelector('.existing-flag-count');
                    if (reopenEl.textContent.indexOf('reopen') > -1 && reopenCountEl) {
                        question.reopen_vote_count = +reopenCountEl.textContent;
                    }
                }
                //Check if there are non-visible comments
                var moreCommentsEl = document.querySelector('#question a.js-show-link.comments-link b');
                if (moreCommentsEl) {
                    question.comment_count += +moreCommentsEl.textContent;
                }
                if (question.creation_date === '') {
                    question.creation_date = elementTooltipTextAsDateSeconds(findElementWithMatchingText('#qinfo p.label-key', /(ago|today)/));
                }
                if (isMagicTag) {
                    question.view_count = +getRestOfTextWithMatchingText('.review-information .review-info', 'View count:').trim();
                    if (question.creation_date === '') {
                        question.creation_date = elementTooltipTextAsDateSeconds(findElementWithMatchingText('.review-information .review-info', /Creation date:/));
                    }
                    if (question.last_edit_date === '') {
                        question.last_edit_date = elementTooltipTextAsDateSeconds(findElementWithMatchingText('.review-information .review-info', /Last edit date:/));
                    }
                }
                if (!isDeleted) {
                    //The API does not return any question data for deleted questions.
                    return question;
                } //else
                return null;
            }

            var response = {
                items: [],
                max_quota: 99999,
                quota_remaining: 99998,
            };
            var question = getQuestionDataFromPage();
            if (question) {
                //Add the question to the response data structure if it should be (i.e. per API, not when question is deleted).
                response.items.push(question);
            }
            //Pass the data to the callback function, as if it was being returned by the SE API.
            if (typeof callback === 'function') {
                callback(JSON.stringify(response));
            }
        }

        function addRoombaField() {
            //Create the basics of the 'qinfo' table row which shows Roomba information.
            const table = getElementContainingRoombaTable();
            if (!table) {
                //Detect a bug/corruption in Microsoft Edge with Tampermonkey where the script is run twice, but the second
                //  time the document does not contain the elements we need. This is handled
                //  by detecting that the qinfo table does not appear to exist, and aborting.
                return 'ABORT';
            }
            let fieldRowHtml = '' +
                '<tr class="roombaTooltip" id="roombaFieldRow">' +
                '    <td id="roombaFieldRowLabel">' +
                '        <a>' +
                '            <p class="label-key">roomba</p>' +
                '        </a>' +
                '    </td>' +
                //SE applies padding-left to each value cell in the style attribute. Thus, that is duplicated here.
                '    <td style="padding-left: 10px;">' +
                '        <p class="label-key">' +
                '            <a id="roombaField" class="roombaLinkInherit">...</a>' +
                '        </p>' +
                '    </td>' +
                '</tr>' +
                '';
            const tbody = table.querySelector('tbody');
            if (isCloseReview) {
                fieldRowHtml = '' +
                    '<tr class="roombaTooltip" id="roombaFieldRow">' +
                    '    <td id="roombaFieldRowLabel" class="label-key">' +
                    '        <span>roomba</span>' +
                    '    </td>' +
                    '    <td class="label-value">' +
                    '        <span id="roombaField" class="roombaLinkInherit">...</span>' +
                    '    </td>' +
                    '</tr>' +
                    '';
                let after = tbody.firstChild;
                while (after.nextElementSibling && after.nextElementSibling.textContent.trim()) {
                    after = after.nextElementSibling;
                }
                after.insertAdjacentHTML('afterend', fieldRowHtml);
            } else if (isMagicTag) {
                fieldRowHtml = '' +
                    '<div class="spacer review-info roombaTooltip" id="roombaFieldRow">' +
                    '    <label class="left" id="roombaFieldRowLabel">roomba:</label>' +
                    '    <span class="right" id="roombaField">...</span>' +
                    '</div>' +
                    '';
                table.insertAdjacentHTML('beforeend', fieldRowHtml);
            } else if (isViewsBelowTitle) {
                const cells = table.querySelectorAll('#question-header + div.grid > .grid--cell');
                const oldLastDiv = cells[cells.length - 1];
                oldLastDiv.classList.add('mr16');
                fieldRowHtml = '' +
                    '<div class="grid--cell ws-nowrap mb8 mr16 roombaTooltip" id="roombaFieldRow">' +
                    '    <span class="fc-light mr2" id="roombaFieldRowLabel">Roomba</span>' +
                    '    <span id="roombaField">...</span>' +
                    '</div>' +
                    '';
                table.insertAdjacentHTML('beforeend', fieldRowHtml);
                const roombaFieldRow = document.getElementById('roombaFieldRow');
                const roombaOptionsDiv = document.getElementById('roombaOptionsDiv');
                if (roombaOptionsDiv) {
                    roombaFieldRow.insertAdjacentElement('beforebegin', roombaOptionsDiv);
                }
            } else {
                tbody.insertAdjacentHTML('beforeend', fieldRowHtml);
            }
            return 'roombaField';
        }

        function hideShortRoombaStatusIfConfigured() {
            //Don't show the status row if configured not to do so.
            hideShortRoombaStatusIfConfiguredInObject(config);
        }

        function hideShortRoombaStatusIfConfiguredInObject(obj) {
            //Don't show the status row if the configuration in the object is to not to do so.
            if (!obj.showShortRoombaStatus) {
                var roombaFieldRow = document.querySelector('#roombaFieldRow');
                if (roombaFieldRow) {
                    roombaFieldRow.style.display = 'none';
                }
            }
        }

        function removeExistingRoombaElementsIfExist() {
            //Clean up from the inserted elements
            removeRoombaStyleIfExists();
            removeRoombaTableIfExists();
            removeRoombaFieldRowIfExists();
            removeRoombaOptionsIfExists();
        }

        function removeRoombaStyleIfExists() {
            //Remove the style
            var styleEl = document.getElementById('roombaStyle');
            if (styleEl) {
                styleEl.parentNode.removeChild(styleEl);
            }
        }

        function removeRoombaTableIfExists() {
            //Remove the Roomba Table
            var roombaTableDiv = document.getElementById('roombaTableDiv');
            if (roombaTableDiv) {
                roombaTableDiv.parentNode.removeChild(roombaTableDiv);
            }
        }

        function removeRoombaFieldRowIfExists() {
            //Remove the previously added row, if it exists.
            var oldRowEl = document.getElementById('roombaFieldRow');
            if (oldRowEl) {
                oldRowEl.parentNode.removeChild(oldRowEl);
            }
        }

        function removeRoombaOptionsIfExists() {
            //The Roomba Options
            var roombaOptionsDiv = document.getElementById('roombaOptionsDiv');
            if (roombaOptionsDiv) {
                roombaOptionsDiv.parentNode.removeChild(roombaOptionsDiv);
            }
        }

        function insertStyles() {
            //Add the Roomba Forecaster styles to the DOM.
            const styleEl = document.createElement('style');
            const sidebarWidth = document.querySelector(sidebarSelector).getBoundingClientRect().width;
            const styleId = 'roombaStyle';

            styleEl.id = styleId;
            styleEl.setAttribute('type', 'text/css');
            //Comments actually in the CSS disrupt Edge
            var cssFirefox = '' +
                //Match stock Firefox tooltips
                '#roombaTableDivDiv.roombaTooltipText {\n' +
                '    background-color: #FEFEFE;\n' +
                '    border: 1px solid #6E7276;\n' +
                '}\n' +
                '#roombaTable ul {\n' +
                '    margin-right: -5px;\n' +
                '    margin-left: 10px;\n' +
                '}\n' +
                '#roombaTable li span {\n' +
                '    left:-4px;\n' +
                '}\n' +
                '#roombaTable .label-key,\n' +
                '#roombaTable td,\n' +
                '#roombaTable th,\n' +
                '.roombaLinkInherit {\n' +
                '    color: #3E4246;\n' +
                '}\n' +
                '';
            var cssEdge = '' +
                //Match stock Edge tooltips
                '#roombaTableDivDiv.roombaTooltipText {\n' +
                '    border: 2px solid #808080;\n' +
                '    background-color: #FFFFFF;\n' +
                '    width:' + (sidebarWidth - 10) + 'px;\n' +
                '}\n' +
                '#roombaTable ul {\n' +
                '    margin-right: -10px;\n' +
                '    margin-left: 15px;\n' +
                '}\n' +
                '#roombaTable li span {\n' +
                '    left:-8px;\n' +
                '}\n' +
                '';
            var cssChrome = '' +
                //Match stock Chrome tooltips
                '#roombaTableDivDiv.roombaTooltipText {\n' +
                '    border: 1px solid #767676;\n' +
                '    background-color: #FFFFFF;\n' +
                '}\n' +
                '#roombaTable ul {\n' +
                '    margin-right: -9px;\n' +
                '    margin-left: 13px;\n' +
                '}\n' +
                '#roombaTable li span {\n' +
                '    left:-8px;\n' +
                '}\n' +
                '#roombaTable .label-key,\n' +
                '#roombaTable td,\n' +
                '#roombaTable th,\n' +
                '.roombaLinkInherit {\n' +
                '    color: #5E6266;\n' +
                '}\n' +
                '';
            var cssRoombaTable = '' +
                '#roombaTable ul {\n' +
                '    margin-bottom: .2em;\n' +
                '}\n' +
                '#roombaTableDiv {\n' +
                '    font-size: inherit;\n' +
                '    display: inline;\n' +
                '}\n' +
                '#roombaTableDivDiv {\n' +
                '    width:' + (sidebarWidth - 8) + 'px;\n' +
                '}\n' +
                '#roombaTable {\n' +
                '    border-collapse: collapse;\n' +
                '    margin:0 auto;\n' +
                '    display:table;\n' +
                '    color: inherit;\n' +
                '    width: 100%;\n' +
                '}\n' +
                '#roombaTable, #roombaTable td,  #roombaTable th {\n' +
                '    border: 1px solid;\n' +
                '    vertical-align: text-top;\n' +
                '}\n' +
                '#roombaTable td, #roombaTable th,\n' +
                '.roombaLinkInherit {\n' +
                '    color: inherit;\n' +
                '}\n' +
                '#roombaTable li span {\n' +
                '    position:relative;\n' +
                '}\n' +
                '#roombaTable td, #roombaTable th {\n' +
                '    padding-right:5px;\n' +
                '    padding-left:5px;\n' +
                '}\n' +
                '#roombaTable th {\n' +
                '    text-align:center;\n' +
                '}\n' +
                '#roombaTable caption {\n' +
                '    margin-bottom: 3px;\n' +
                '}\n' +
                '#roombaTable caption b {\n' +
                '    font-weight: 700;\n' +
                '    color: inherit;\n' +
                '}\n' +
                '';
            var cssShortStatus = '' +
                '#roombaTableShort td, #roombaTableShort th {\n' +
                '    vertical-align: text-top;\n' +
                '    padding: 0;\n' +
                '}\n' +
                '#roombaTableShort .roombaReasonsCell {\n' +
                '    padding-left:10px;\n' +
                '}\n' +
                '#roombaRow {\n' +
                '    border-collapse: collapse;\n' +
                '}\n' +
                '#roombaFieldRowLabel {\n' +
                '    vertical-align: text-top;\n' +
                '}\n' +
                '';
            var cssToolTip = '' +
                '.roombaTooltipTextPositionDiv {\n' +
                '    position:relative;\n' +
                '}\n' +
                '.roombaTooltipText {\n' +
                '    visibility: hidden;\n' +
                '    padding:3px;\n' +
                '    z-index:2;\n' +
                '    position:absolute;\n' +
                '    left: 0px;\n' +
                '    top: 3em;\n' +
                '    box-shadow: 0px 5px 5px -3px #8E8E8E;\n' +
                '}\n' +
                '.roombaTooltip:hover .roombaTooltipText {\n' +
                '    visibility: visible;\n' +
                '}\n' +
                '';
            var cssOptions = '' +
                '.roombaOptionsSubOptions {\n' +
                '    padding-left:2em;\n' +
                '}\n' +
                '#roombaOptionsDiv {\n' +
                '    position:relative;\n' +
                '}\n' +
                '#roombaOptionsAbsoluteDiv {\n' +
                '    width:300px;\n' +
                '    position:absolute;\n' +
                '    z-index:9;\n' +
                '    top: 0em;\n' +
                '    left: -110%;\n' +
                '    border: 1px solid;\n' +
                '    box-shadow: 0px 2px 5px;\n' +
                '    background-color:white;\n' +
                '    padding:5px;\n' +
                '    opacity:0;\n' +
                '    transition:opacity .2s ease-in-out;\n' +
                '    margin:0px;\n' +
                '}\n' +
                '#roombaOptionsDiv label {\n' +
                '    display:block;\n' +
                '    padding-left:2em;\n' +
                '    text-indent:-2em;\n' +
                '}\n' +
                '#roombaOptionsButtonDiv {\n' +
                '    margin:0 auto;\n' +
                '    display:table;\n' +
                '    margin-bottom:.5em;\n' +
                '    margin-top:.5em;\n' +
                '}\n' +
                '#roombaOptionsButtonDiv button {\n' +
                '    margin-right:1em;\n' +
                '    margin-left:.8em;\n' +
                '}\n' +
                '.roombaOptionsWarning {\n' +
                '    text-align:center;\n' +
                '    color:red;\n' +
                '    font-size:150%;\n' +
                '    margin-top:1em;\n' +
                '    margin-bottom:1em;\n' +
                '    line-height:1.5em;\n' +
                '}\n' +
                '.roombaOptionsTitle {\n' +
                '    text-align:center;\n' +
                '    font-size:150%;\n' +
                '    margin-bottom:.5em;\n' +
                '}\n' +
                '';
            var cssViewsBelowTitle = '' +
                '#roombaOptionsAbsoluteDiv {\n' +
                '    z-index:999;\n' +
                '    top: 10em;\n' +
                '    left: -50%;\n' +
                '}\n' +
                '.roombaTooltipText {\n' +
                '    top: 1.1em;\n' +
                '}\n' +
                '';
            var cssBase = '' +
                '.roombaShowOverflow {\n' +
                '    overflow:visible !important;\n' +
                '}\n' +
                '.roombaLinkInherit:hover {\n' +
                '    color: inherit;\n' +
                '}\n' +
                '.roombaSmallText {\n' +
                '    font-size: 10px;\n' +
                '}\n' +
                '#roombaField,\n' +
                '#roombaFieldRowLabel {\n' +
                '    cursor: pointer;\n' +
                '}\n' +
                '#roombaFieldRow {\n' +
                '    min-height: 9px;\n' +
                '    z-index: 998;\n' +
                '}\n' +
                '#question-header + div.grid #roombaFieldRow {\n' +
                '    transform: translateY(0px);\n' +
                '}\n' +
                '#question-header + div.grid #roombaField {\n' +
                '    display: inline-flex;\n' +
                '}\n' +
                '#question-header + div.grid #roombaField b {\n' +
                '    font-weight: normal;\n' +
                '}\n' +
                '';
            var cssMagicTag = '' +
                '.review-information #roombaField.right {\n' +
                '    max-width: 160px;\n' +
                '}\n' +
                '.review-information #roombaFieldRow {\n' +
                '    overflow: visible;\n' +
                '}\n' +
                '.review-information #roombaTableDivDiv {' +
                '    width: 310px;' +
                '}' +
                '.review-information .roombaTooltipText {' +
                '    left: -40px;' +
                '    top: 3em;' +
                '}' +
                '.review-information #roombaTableDivDiv {' +
                '    font-weight: initial;' +
                '}' +
                '.review-information #roombaTableShort b {' +
                '    font-weight: normal;' +
                '}' +
                '';
            var cssToUse = cssRoombaTable + cssShortStatus + cssToolTip + cssOptions + cssBase + cssMagicTag;
            if (isViewsBelowTitle) {
                cssToUse += cssViewsBelowTitle;
            }
            if (isFirefox) {
                cssToUse += cssFirefox;
            } else if (isEdge) {
                cssToUse += cssEdge;
            } else {
                //Default to using Chrome style.
                cssToUse += cssChrome;
            }
            styleEl.textContent = cssToUse;
            const head = document.head;
            const oldStyleElement = head.querySelector(`#${styleId}`);
            if (oldStyleElement) {
                oldStyleElement.remove();
            }
            head.appendChild(styleEl);
        }

        //Create the basics of the Roomba row. The API call could take time, so let the user see
        //  that the Roomba line exists.
        removeExistingRoombaElementsIfExist();
        var roombaFieldId = addRoombaField();
        if (roombaFieldId === 'ABORT') {
            //Handle an issue in Edge where this script is run twice for no apparent reason.
            return;
        }
        insertStyles();
        hideShortRoombaStatusIfConfigured(); //Don't show the short status

        const questionId = getQuestionId();
        if (!questionId) {
            console.error('Roomba Forecaster: Did not find a valid question ID.');
            return;
        }
        //Get the question data from either the API or scraping the page.
        getRequestJson('GET', 'https://api.stackexchange.com/2.2/questions/' + questionId + '?site=' + location.hostname + '&filter=' + FILTER_ID + '&key=' + API_KEY, null, function(response) {
            //The response has been received.
            var data = JSON.parse(response);
            var question = data.items[0];
            var minRoombaDays = 999;
            var roombaFrequency = '';
            var downvoteWillQualify = 0; //Used as a bit field with values: 0, 1, 2, 3
            const downvoteWillQualifyByRoomba = {}; //Used as a bit field for each Roomba with values: 0, 1, 2, 3

            function getDaysText(days) {
                //Handle pluralizing 'day'
                days = +days;
                return days + ' day' + (days === 1 ? '' : 's');
            }

            function getListHtml(list) {
                //Convert the long list of reasons into HTML as they will be displayed.
                return '<ul><li><span>' + list.join('</span><li><span>') + '</span></ul>';
            }

            function getListShortHtml(list) {
                //Convert the short list of reasons into HTML as they will be displayed.
                return list.join(',');
            }

            function getNowDay() {
                //Get the current day/time in days from Epoch.
                return Date.now() / 1000 / SECONDS_IN_DAY;
            }

            function computeExtraQuestionData(q) {
                //Compute various data about the question from the supplied question information.
                var nowDay = getNowDay();
                q.closedDay = (q.closed_date || 0) / SECONDS_IN_DAY;
                q.lastEditDay = (q.last_edit_date || q.creation_date) / SECONDS_IN_DAY;
                q.creationDay = (q.creation_date || 0) / SECONDS_IN_DAY;
                q.ageDays = nowDay - q.creationDay;
                //Get a count of answers
                q.answerCount = 0;
                q.positiveScoreAnswerCount = 0;
                if ('answers' in q) {
                    q.maxAnswerScoreCount = 0;
                    q.maxAnswerScore = -99999;
                    q.answerCount = q.answers.length;
                    q.positiveScoreAnswers = q.answers.filter(function(answer) {
                        //Count the number of answers with a max score
                        var answerScoreNum = +answer.score;
                        if (q.maxAnswerScore === answerScoreNum) {
                            q.maxAnswerScoreCount++;
                        }
                        if (q.maxAnswerScore < answerScoreNum) {
                            q.maxAnswerScore = answerScoreNum;
                            q.maxAnswerScoreCount = 1;
                        }
                        return answer.score > 0;
                    });
                    q.positiveScoreAnswerCount = q.positiveScoreAnswers.length;
                }
            }

            function testCriteriaAndMakeHtml(curRoomba) {
                //Test the question against the Roomba criteria.
                function handleOverrides(theRoomba) {
                    //Deal with 'overrides' which by their existence qualify the question for Roomba under this roomba entry.
                    //  This is accomplished by eliminating any already existing reasons for disqualification.
                    var overrides = theRoomba.overrides;
                    if (typeof overrides !== 'object') {
                        return;
                    } //else
                    var override = false;
                    if ((getNowDay() - question.closedDay) < 16) {
                        //This question: https://softwareengineering.stackexchange.com/q/122569/151503 meets all of the stated criteria, but has not
                        //  been deleted in many years. Thus, there are some unstated criteria. The unstated criteria which allow a question to remain
                        //  undeleted are handled by checking if there has been enough time for the weekly Roomba to have deleted the question, twice.
                        //  If that is the case, then it is assumed that the Roomba will never delete it.
                        //A rejected migration from another site means the question is closed here (https://meta.stackexchange.com/a/10250/271271).
                        //  This has only been minimally tested.
                        if (overrides.closedAndMigratedAway && 'closed_date' in question && 'migrated_to' in question) {
                            override = true;
                        }
                        if (overrides.migratedHereAndRejected && 'closed_date' in question && 'migrated_from' in question && (question.closed_reason || '').indexOf('duplicate') === -1) {
                            override = true;
                        }
                    }
                    if (override) {
                        theRoomba.reasons = [];
                        theRoomba.shortReasons = [];
                    }
                }

                function makeRoombaHtml(theRoomba) {
                    //Create the HTML that will be used for the roomba entry. This will either be the HTML of
                    //  the lists of reasons (long and short), or the number of days remaining until deletion.
                    function logInvalidTimeCriteria(aRoomba) {
                        //Log if the time criteria is not understood.
                        const time = aRoomba.criteria.time;
                        const validCriteriaTime = ['daysDelayFromEdit', 'daysDelayFromClose', 'daysOffsetFromReportedCloseToClose', 'age'];
                        Object.keys(time).forEach(function(timeCriteria) {
                            if (validCriteriaTime.indexOf(timeCriteria) === -1) {
                                console.log('The time criteria:', timeCriteria, ' is not one which this code knows how to check. Roomba:', aRoomba);
                            } else {
                                //All criteria must be numbers
                                if (typeof time[timeCriteria] !== 'number') {
                                    console.log('The time criteria:', timeCriteria, ' is not a number:', time[timeCriteria], ' Roomba:', aRoomba);
                                }
                            }
                        });
                    }

                    function getFirstPossibleWeeklyRoombaPastDate(dateSeconds) {
                        //Compute the first time a weekly Roomba will run after the time specified in seconds.
                        function getSecondsFromWeekStart(day, hour, minute, second) {
                            day = isNaN(+day) ? 0 : +day;
                            hour = isNaN(+hour) ? 0 : +hour;
                            minute = isNaN(+minute) ? 0 : +minute;
                            second = isNaN(+second) ? 0 : +second;
                            return (((((24 * day) + hour) * 60) + minute) * 60) + +second;
                        }

                        //The weekly Roomba runs on the Saturday (day of the week 6) at about 00:30 UTC (based on observation).
                        const weeklyRoombaUTCDay = 6;
                        const weeklyRoombaUTCHour = 0;
                        const weeklyRoombaUTCminutes = 30;

                        const firstPossibleRoomba = {};
                        //Convert the date/time in seconds to a day of the week, hour, and minute (ignore seconds).
                        firstPossibleRoomba.date = new Date(dateSeconds * 1000);
                        firstPossibleRoomba.weekDay = firstPossibleRoomba.date.getUTCDay();
                        firstPossibleRoomba.hour = firstPossibleRoomba.date.getUTCHours();
                        firstPossibleRoomba.minute = firstPossibleRoomba.date.getUTCMinutes();
                        firstPossibleRoomba.second = firstPossibleRoomba.date.getUTCSeconds();
                        firstPossibleRoomba.monthDay = firstPossibleRoomba.date.getUTCDate();
                        //Find the seconds between the date provided and when the first weekly Roomba will run.
                        const relativeWeeklyRoombaSeconds = getSecondsFromWeekStart(weeklyRoombaUTCDay, weeklyRoombaUTCHour, weeklyRoombaUTCminutes);
                        const relativeCreatedSeconds = getSecondsFromWeekStart(firstPossibleRoomba.weekDay, firstPossibleRoomba.hour, firstPossibleRoomba.minute, firstPossibleRoomba.second);
                        let additionalSecondsToFirstRoomba = relativeWeeklyRoombaSeconds - relativeCreatedSeconds;
                        if (additionalSecondsToFirstRoomba < 0) {
                            additionalSecondsToFirstRoomba += 7 * SECONDS_IN_DAY;
                        }
                        return dateSeconds + additionalSecondsToFirstRoomba;
                    }

                    var nowDay = getNowDay();
                    var time = theRoomba.criteria.time;
                    //Validate time criteria
                    logInvalidTimeCriteria(theRoomba);

                    if (theRoomba.reasons.length > 0) {
                        //The question is not qualified. Create the HTML of reasons.
                        theRoomba.html = getListHtml(theRoomba.reasons);
                        theRoomba.shortHtml = getListShortHtml(theRoomba.shortReasons);
                    } else {
                        //The question is qualified. Compute the number of days remaining and create the HTML.
                        //  The minimum of the set of time criteria specified is used.
                        theRoomba.remainingDays = 0;
                        if ('age' in time) {
                            //The number of days remaining is based on the age of the question.
                            if (theRoomba.frequency === 'weekly') {
                                //But, if the Roomba is weekly, then we need to compute the days to the next time the weekly Roomba will run.
                                //Find the time at which the question could first be/have been Roomba'd.
                                const firstPossibleRoomba = getFirstPossibleWeeklyRoombaPastDate(question.creation_date + (time.age * SECONDS_IN_DAY));
                                //The next weekly Roomba will run at
                                const firstRoombaFromNow = getFirstPossibleWeeklyRoombaPastDate(getNowDay() * SECONDS_IN_DAY);
                                //The date/time when the Roomba will run as a floating point number of days.
                                const willRoombaDay = Math.max(firstPossibleRoomba, firstRoombaFromNow) / SECONDS_IN_DAY;
                                theRoomba.remainingDays = Math.max(Math.round(willRoombaDay - getNowDay()), theRoomba.remainingDays);
                            } else {
                                //This is not currently used, as there aren't any Roomba tasks that are not weekly which depend on the question creation date.
                                theRoomba.remainingDays = Math.max(Math.round(time.age - question.ageDays), theRoomba.remainingDays);
                            }
                        }
                        if ('daysDelayFromEdit' in time) {
                            //The number of days remaining is based on the days from the last question edit.
                            theRoomba.remainingDays = Math.max(Math.floor(question.lastEditDay - nowDay) + time.daysDelayFromEdit, theRoomba.remainingDays);
                        }
                        if ('daysDelayFromClose' in time) {
                            //The number of days remaining is based on the days from when the question was closed. The API returns
                            //  as the "close" date the day the question was put on hold. Thus, this needs a fudge factor to account
                            //  for that..
                            theRoomba.remainingDays = Math.max(Math.floor(question.closedDay - nowDay) + time.daysDelayFromClose + time.daysOffsetFromReportedCloseToClose, theRoomba.remainingDays);
                        }
                        theRoomba.html = getDaysText(theRoomba.remainingDays);
                        theRoomba.shortHtml = theRoomba.html.replace(/ days*/i, 'D');
                    }
                }

                function testCriteria(theRoomba) {
                    //Test the roomba entry's criteria
                    //  The return value is based on if the question will qualify if the question, or answer(s) are downvoted.
                    //    0 = Not qualified with a single person's downvotes. (DOWNVOTE_QUALIFIES_NONE)
                    //    1 = Qualifies with a question downvote (DOWNVOTE_QUALIFIES_QUESTION)
                    //    2 = Qualifies with a downvote on at least one answer. (DOWNVOTE_QUALIFIES_ANSWER)
                    //    3 = Qualifies if downvotes are placed on both the question and at least one answer. (DOWNVOTE_QUALIFIES_QUESTION & DOWNVOTE_QUALIFIES_ANSWER)
                    const criteria = theRoomba.criteria;

                    function addReason(longReason, shortReason) {
                        //Add a reason to the short and long reason lists.
                        theRoomba.reasons.push(longReason);
                        theRoomba.shortReasons.push(shortReason);
                    }

                    function addReasonsBooleanCriteria(criteriaName, questionTest, longReason, shortReason) {
                        //Add the specified reasons if the question fails the Boolean criteria.
                        if (criteriaName in criteria) {
                            if (criteria[criteriaName] && !questionTest) {
                                addReason('not&nbsp;' + longReason, '!' + shortReason);
                                return true;
                            } //else
                            if (!criteria[criteriaName] && questionTest) {
                                addReason(longReason, shortReason);
                                return true;
                            } //else
                        }
                        return false;
                    }

                    function addReasonsQuestionAboveNumericCriteria(criteriaName, questionValue, longReason, shortReason, altLongText, longPlurals) {
                        //Add the specified reasons if the value for the question is above the numeric criteria.
                        if (criteriaName in criteria) {
                            var criteriaValue = criteria[criteriaName];
                            if (questionValue > criteriaValue) {
                                if (altLongText) {
                                    addReason('>' + criteriaValue + '&nbsp;' + longReason + ((longPlurals && criteriaValue !== 1) ? 's' : ''), shortReason + '>' + criteriaValue);
                                    return true;
                                } // else
                                addReason(longReason + ((longPlurals && criteriaValue !== 1) ? 's' : '') + '&nbsp;>&nbsp;' + criteriaValue, shortReason + '>' + criteriaValue);
                                return true;
                            }
                        }
                        return false;
                    }

                    function logInvalidCriteria(aRoomba) {
                        //Validate the criteria.
                        const validCriteria = {
                            isLocked: 'boolean',
                            maxAnswers: 'number',
                            maxScore: 'number',
                            maxScoreOwnerDeleted: 'number',
                            isClosed: 'boolean',
                            isDuplicate: 'boolean',
                            maxAnswerScore: 'number',
                            hasAcceptedAnswer: 'boolean',
                            hasReopenVotes: 'boolean',
                            ageToViewMultiplier: 'number',
                            maxComments: 'number',
                            isMeta: 'boolean',
                            time: 'object',
                        };
                        Object.keys(criteria).forEach(function(checkCriteria) {
                            if (!({}).hasOwnProperty.call(validCriteria, checkCriteria)) {
                                console.log('Invalid criteria: Unknown property:', checkCriteria, ' Roomba:', aRoomba);
                            } else {
                                //All criteria must be numbers
                                if (typeof criteria[checkCriteria] !== validCriteria[checkCriteria]) {
                                    console.log('Invalid criteria: The criteria:', checkCriteria, ' is not a ' + validCriteria[checkCriteria] + ' value found:', criteria[checkCriteria], ' Roomba:', aRoomba);
                                }
                            }
                        });
                    }

                    //Track if question or answer downvotes could qualify the question for this roomba.
                    var downvoteQuestionCouldQualify = false;
                    var downvoteAnswerCouldQualify = false;

                    //Validate input
                    logInvalidCriteria(theRoomba);

                    //Not Locked
                    addReasonsBooleanCriteria('isLocked', 'locked_date' in question, 'locked', 'L');

                    //Answer count
                    if ('maxAnswers' in criteria && question.answerCount > criteria.maxAnswers) {
                        if (criteria.maxAnswers === 0) {
                            addReason('answered', 'A');
                        } else {
                            addReason('answers > ' + criteria.maxAnswers, 'A>' + criteria.maxAnswers);
                        }
                    }

                    //Question score too high
                    var questionScoreMax = criteria.maxScore;
                    if (criteria.maxScoreOwnerDeleted && question.owner.user_type === 'does_not_exist') {
                        questionScoreMax = criteria.maxScoreOwnerDeleted;
                    }
                    if (('maxScore' in criteria || 'maxScoreOwnerDeleted' in criteria) && question.score > questionScoreMax) {
                        addReason('score&nbsp;>&nbsp;' + questionScoreMax, 'S>' + questionScoreMax);
                        downvoteQuestionCouldQualify = downvoteQuestionCouldQualify || question.score === (questionScoreMax + 1);
                    }

                    //Is closed
                    addReasonsBooleanCriteria('isClosed', ('closed_date' in question), 'closed', 'Cl');

                    //Is a duplicate
                    addReasonsBooleanCriteria('isDuplicate', ((question.closed_reason || '').indexOf('duplicate') > -1), 'duplicate', 'Du');

                    //Has a positive score answer
                    var metCriteria = addReasonsQuestionAboveNumericCriteria('maxAnswerScore', question.maxAnswerScore, 'answer<br/>&nbsp;&nbsp;&nbsp;&nbsp;score', 'AS');
                    if (metCriteria) {
                        //Check to see if some number of single votes will qualify the roomba
                        if ((criteria.maxAnswerScore + 1) === question.maxAnswerScore) {
                            downvoteAnswerCouldQualify = true;
                        }
                    }

                    //Has an accepted answer
                    addReasonsBooleanCriteria('hasAcceptedAnswer', 'accepted_answer_id' in question, 'accepted<br/>&nbsp;&nbsp;&nbsp;&nbsp;answer', 'Ac');

                    //Has reopen votes
                    addReasonsBooleanCriteria('hasReopenVotes', question.reopen_vote_count > 0, 'reopen&nbsp;votes', 'RV');

                    //Compute max views if age to View Multiplier
                    if ('ageToViewMultiplier' in criteria) {
                        var maxViews = Math.round(question.ageDays * criteria.ageToViewMultiplier);
                        if (question.view_count > maxViews) {
                            //Above maximum views
                            //If the number we are adding is > 999, then don't have spaces around the '>'.
                            //  This is done to limit the size of that column.
                            addReason('>' + maxViews + '&nbsp;view' + (maxViews !== 1 ? 's' : ''), 'Vi>Da');
                        }
                    }

                    //Too many comments
                    addReasonsQuestionAboveNumericCriteria('maxComments', question.comment_count, 'comment', 'Co', true, true);

                    //Not on Meta
                    addReasonsBooleanCriteria('isMeta', isMeta, 'is meta site', 'Me', true);

                    //Prepare return value based on question and answer downvote qualifications.
                    var returnValue = 0;
                    if (theRoomba.reasons.length === 1) {
                        if (downvoteQuestionCouldQualify) {
                            returnValue = DOWNVOTE_QUALIFIES_QUESTION;
                        }
                        if (downvoteAnswerCouldQualify) {
                            returnValue = DOWNVOTE_QUALIFIES_ANSWER;
                        }
                    }
                    if (theRoomba.reasons.length === 2 && downvoteQuestionCouldQualify && downvoteAnswerCouldQualify) {
                        returnValue = DOWNVOTE_QUALIFIES_QUESTION | DOWNVOTE_QUALIFIES_ANSWER; // eslint-disable-line no-bitwise
                    }
                    return returnValue;
                }

                var downvoteQuals = testCriteria(curRoomba);
                handleOverrides(curRoomba);
                makeRoombaHtml(curRoomba);
                return downvoteQuals;
            }

            function insertLargeRoombaTable(useShortHeaders, thisMinRoombaDays, thisRoombaFrequency) {
                //Crete the HTML for the Roomba Table, insert it and adjust as desired.
                //Two divs are used here in order for the outer div to set the relative location for the inner one when
                //  it is positioned relative as a tooltip. This is needed because Chrome does not implement
                //  position:relative for tr elements (where the tooltip is placed in the DOM to permit CSS to
                //  handle showing the tooltip.
                var roombaTableHtml = '' +
                    '<div id="roombaTableDiv">' +
                    '    <div id="roombaTableDivDiv" class="label-key">' +
                    '        <a class="roombaLinkInherit">' +
                    '            <table id="roombaTable">' +
                    '                <tbody>' +
                    '                    <tr>' +
                    '';
                roombas.forEach(function(curRoomba) {
                    var headerText = curRoomba.headerText;
                    if (useShortHeaders) {
                        headerText = curRoomba.headerTextShort;
                    }
                    roombaTableHtml += '<th>' + headerText + '</th>';
                });
                roombaTableHtml += '</tr></tbody></table></a></div></div>';
                if (isViewsBelowTitle) {
                    getElementContainingRoombaTable().insertAdjacentHTML('beforeend', roombaTableHtml);
                } else {
                    getElementContainingRoombaTable().insertAdjacentHTML('afterend', roombaTableHtml);
                }
                var table = document.getElementById('roombaTable');
                var caption = table.createCaption();
                var daysQual;
                if (thisMinRoombaDays < 999) {
                    //Roomba will delete
                    daysQual = 'in ' + getDaysText(thisMinRoombaDays) + '</B> (' + thisRoombaFrequency + ')';
                } else {
                    //Roomba will not delete
                    daysQual = 'Not qualified</B>';
                }
                caption.innerHTML = 'Roomba: <B>' + daysQual;
                caption.className = 'label-key';
                var newRow = table.insertRow();
                roombas.forEach(function(curRoomba) {
                    newRow.insertCell().innerHTML = curRoomba.html;
                });
            }

            function populateRoombaField(downvoteQualifies, downvoteQualifiesByRoomba, thisMinRoombaDays, thisRoombaFrequency) {
                //Insert the small table with values into the roombaField
                function afterWindowLoad() {
                    //Tasks that need to happen after the window.onload event.
                    //  The indicators that the user has voted are not available when we first run. We have
                    //  to check for them after they are available.
                    //  Hide the text stating that downvoting the question will Roomba if
                    //  the user has already downvoted.
                    if (document.querySelector('#question .js-vote-down-btn.fc-theme-primary')) {
                        //The question has already been downvoted by the user.
                        const downQualsSpan = document.getElementById('roombaDownVoteQualifies');
                        if (downQualsSpan && /question/.test(downQualsSpan.textContent)) {
                            //If the user would need to downvote the question to make it Roomba,
                            //  but has already done so, then the user can't make it Roomba.
                            downQualsSpan.textContent = '';
                        }
                    }
                }
                var roombaField = document.getElementById(roombaFieldId);
                var shortDaysQual;
                if (thisMinRoombaDays < 999) {
                    //Roomba will delete
                    shortDaysQual = '<b>' + getDaysText(thisMinRoombaDays) + ' (' + thisRoombaFrequency + ')</b>';
                    roombaField.innerHTML = shortDaysQual;
                } else {
                    //Roomba will not delete
                    shortDaysQual = '<B>No</B> ';
                    //Build the HTML for the short reasons.
                    var shortReasons = '';
                    roombas.forEach(function(curRoomba) {
                        if (shortReasons) {
                            //The &nbsp; adds a bit more space between short reasons for the roombas.
                            shortReasons += ' &nbsp;';
                        }
                        shortReasons += curRoomba.shortReasonPrefix + '=' + curRoomba.shortHtml + ';';
                    });
                    //Determine text, if any, describing downvotes that will qualify the question for Roomba
                    var downvoteText = '';
                    if (downvoteQualifies > 0) {
                        if (downvoteQualifies & DOWNVOTE_QUALIFIES_QUESTION) { // eslint-disable-line no-bitwise
                            downvoteText += 'question';
                            //If the user has already downvoted the question, then they can not downvote again.
                            //The information we need is not available until after window.onload, so wait for loading to be complete.
                            if (document.readyState !== 'complete') {
                                window.addEventListener('load', afterWindowLoad, false);
                            } else {
                                //This needs to not be called now, but after everything this script adds.
                                setTimeout(afterWindowLoad, 0);
                            }
                        }
                        if (downvoteQualifies & DOWNVOTE_QUALIFIES_ANSWER) { // eslint-disable-line no-bitwise
                            //Downvoting the highest voted answer will qualify.
                            //XXX Should detect that if that answer has already been downvoted by the user.
                            if (downvoteText !== '') {
                                downvoteText += ' & ';
                            }
                            downvoteText += 'answer';
                            if (question.maxAnswerScoreCount > 1) {
                                downvoteText += 's';
                            }
                        }
                        //XXX Should add notification that a downvote will roomba sooner. This is the case when
                        //  qualified for 365 day roomba (0 score), but not qualified for 30 day roomba (-1 score).
                        downvoteText = 'down-vote ' + downvoteText + ' will roomba';
                        roombas.some(function(roomba) {
                            if (downvoteQualifiesByRoomba[roomba.shortReasonPrefix]) {
                                downvoteText += ' ' + roomba.downvoteText;
                                return true;
                            }
                            return false;
                        });
                    }
                    if (shortReasons && downvoteText) {
                        shortReasons += ' ';
                    }
                    roombaField.innerHTML = '' +
                        '<table id="roombaTableShort"><tbody><tr><td>' + shortDaysQual + '</td><td class="roombaReasonsCell">' +
                        '<span id="roombaShortReasonsSpan">' + shortReasons + '</span>' +
                        '<span id="roombaDownVoteQualifies">' + downvoteText + '</span>' +
                        '</td></tr></tbody></table>' +
                        '';
                }
            }

            function insertRoombaForecasterOptionsDialog() {
                //Add the options dialog to the DOM along with event listeners to control it.
                const qinfo = getElementContainingRoombaTable();
                let intoElementChild = qinfo.parentNode;
                let where = 'beforebegin';
                if (isMagicTag) {
                    //For MagicTag, the options div should be immediately inside the .review-sidebar container,
                    // not two levels up.
                    intoElementChild = qinfo;
                } else if (isViewsBelowTitle) {
                    intoElementChild = qinfo;
                    where = 'beforeend';
                    const roombaFieldRow = document.getElementById('roombaFieldRow');
                    if (roombaFieldRow) {
                        intoElementChild = roombaFieldRow;
                        where = 'beforebegin';
                    }
                }
                intoElementChild.insertAdjacentHTML(where, '' +
                    '<div id="roombaOptionsDiv">' +
                    '    <div id="roombaOptionsAbsoluteDiv">' +
                    '        <div class="roombaOptionsTitle"><B>Roomba Forecaster Options</B></div>' +
                    '        <div class="roombaOptionsWarning" id="roombaOptionsSaveNotWork">' +
                    '            <B>Options can NOT be saved. Edit user script code to change options, or grant permission to save values in this user script.</B>' +
                    '        </div>' +
                    '        <label>' +
                    '            <input type="checkbox" id="roombaOptionsCheckbox-showShortRoombaStatus"/>' +
                    '            Show the Roomba status line under "viewed"/"active".' +
                    '        </label>' +
                    '        <div class="roombaOptionsSubOptions">' +
                    '            <label>' +
                    '                <input type="checkbox" id="roombaOptionsCheckbox-useTooltip"/>' +
                    '                Put the Roomba table in a tooltip.' +
                    '            </label>' +
                    '            <label>' +
                    '                <input type="checkbox" id="roombaOptionsCheckbox-showShortReasons"/>' +
                    '                Show a short version of the reasons the question does not qualify for Roomba.' +
                    '            </label>' +
                    '            <label>' +
                    '                <input type="checkbox" id="roombaOptionsCheckbox-showIfDownvoteWillRoomba"/>' +
                    '                Show if voting down the question or answer(s) will qualify the question for Roomba.' +
                    '            </label>' +
                    '        </div>' +
                    '        <label>' +
                    '            <input type="checkbox" id="roombaOptionsCheckbox-alwaysShowRoombaTable"/>' +
                    '            Always display the Roomba table. [This looks better when in the sidebar.]' +
                    '        </label>' +
                    '        <div id="roombaOptionsAdditionalDiv" style="display:none;">' +
                    '            <br>' +
                    '            <label title="Scraping the page for the data is faster than calling the SE API. There is no data needed that does not already exist on the page. If you think Roomba Forecaster is showing the wrong data, you can try disabling this option. If enabling the use of the SE API does resolve a problem, please raise an issue on GitHub.">' +
                    '                <input type="checkbox" id="roombaOptionsCheckbox-scrapePage" disabled="true"/>' +
                    '                Scrape the page (faster) instead of using the SE API. (disabled until rewritten after SE HTML/text changes wrt. question status banners stabilize) ' +
                    '            </label>' +
                    '        </div>' +
                    '        <div style="width:100%">' +
                    '            <div id="roombaOptionsButtonDiv">' +
                    '                <button id="roombaOptionsSave" title="Save the selected options so they affect all pages you load in the future.">Save</button>' +
                    '                <button id="roombaOptionsClose" title="Any changes you made to the options will affect only this page.">Close</button>' +
                    '                <button id="roombaOptionsCancel" title="Discard any changes you made to the options.">Cancel</button>' +
                    '            </div>' +
                    '        </div>' +
                    '    </div>' +
                    '</div>' +
                    '');
                restoreOptionsFromConfig();
                document.getElementById('roombaOptionsSave').addEventListener('click', optionsSave, true);
                document.getElementById('roombaOptionsClose').addEventListener('click', optionsClose, true);
                document.getElementById('roombaOptionsCancel').addEventListener('click', optionsCancel, true);
                document.getElementById('roombaOptionsDiv').addEventListener('click', handleOptionsClick, false);
                document.getElementById('roombaOptionsDiv').addEventListener('transitionend', optionsTransitionend);
                addDisplayOptionsClickListeners();
                hideOptions();
            }

            function getEffectiveColor(element, styleText, defaultValue) {
                //Does not consider potential background images.
                //Does not handle finding the actual color when there's partial transparency.
                if (!defaultValue) {
                    if (styleText.indexOf('background') > -1) {
                        defaultValue = 'white';
                    } else {
                        defaultValue = 'black';
                    }
                }
                return getEffectiveStyleValue(element, styleText, /(?:transparent|initial|inherit|currentColor|unset|rgba.*,\s*0+(?:\.\d*)?\s*\))/i, defaultValue);
            }

            function getEffectiveStyleValue(element, styleText, rejectRegex, defaultValue) {
                var foundStyleValue;
                do {
                    foundStyleValue = window.getComputedStyle(element).getPropertyValue(styleText);
                    element = element.parentNode;
                    rejectRegex.lastIndex = 0;
                } while (element && rejectRegex.test(foundStyleValue));
                rejectRegex.lastIndex = 0;
                if (rejectRegex.test(foundStyleValue)) {
                    //If no valid style was found, use the default provided.
                    foundStyleValue = defaultValue;
                }
                return foundStyleValue;
            }

            function setOptionDialogBackgroundColor() {
                //Set the Options dialog background color to the current computed color.
                //  This is done to support alternate color schemes. This is needed because the
                //  inherited color is usually 'transparent', which does not work for an overlay.
                //  Should really do a numeric check on rgba() alpha values, but a RegExp appears
                //  sufficient for the pragmatically generated values.
                document.getElementById('roombaOptionsAbsoluteDiv').style.backgroundColor = getEffectiveColor(document.getElementById('content'), 'background-color');
            }

            function addDisplayOptionsClickListeners() {
                //Add listeners for clicking on the status row and Roomba table to toggle display state of the options.
                document.getElementById('roombaTableDiv').addEventListener('click', handleClickEventToToggleOptionDisplay, true);
                document.getElementById('roombaFieldRow').addEventListener('click', handleClickEventToToggleOptionDisplay, true);
            }

            function restoreOptionsFromObject(obj) {
                //Set the state of the options dialog to the contents of an object based on the Object's keys.
                //  The object has the same keys as the config Object.
                configKeys.forEach(function(key) {
                    var el = document.getElementById('roombaOptionsCheckbox-' + key);
                    if (el) {
                        el.checked = obj[key];
                    }
                });
                //Specify which controls should be disabled if any particular one is not set.
                var controlDisables = {
                    showShortRoombaStatus: [
                        'useTooltip',
                        'showShortReasons',
                        'showIfDownvoteWillRoomba',
                    ],
                };
                Object.keys(controlDisables).forEach(function(control) {
                    controlDisables[control].forEach(function(key) {
                        var el = document.getElementById('roombaOptionsCheckbox-' + key);
                        if (el) {
                            el.disabled = !obj[control];
                        }
                    });
                });
                document.getElementById('roombaOptionsSaveNotWork').style.display = configSaveWorking ? 'none' : '';
            }

            function restoreOptionsFromConfig() {
                //Use the config object to set the options dialog.
                restoreOptionsFromObject(config);
            }

            function showOptions(additional) {
                //Display the options dialog
                //The user may have changed the options for this page, not saved, but then hidden them.
                //  Thus, don't update from config. That was already done when the options dialog was created.
                setOptionDialogBackgroundColor();
                const optionsDiv = document.getElementById('roombaOptionsDiv');
                const optionsAbsDiv = document.getElementById('roombaOptionsAbsoluteDiv');
                document.getElementById('roombaOptionsAdditionalDiv').style.display = (additional || !config.scrapePage) ? '' : 'none';
                optionsDiv.style.display = 'block';
                optionsAbsDiv.style.display = 'block';
                optionsAbsDiv.style.opacity = 1;
                optionsAbsDiv.style.pointerEvents = 'auto';
                document.querySelector(sidebarSelector).classList.add('roombaShowOverflow');
                //Add window click handler to hide the options, not using capture. Most valid clicks will
                //  have the event canceled.
                window.addEventListener('click', windowClickWhileOptionsShown, false);
            }

            function windowClickWhileOptionsShown(event) {
                //Handle a click event in the window when the Options are visible.
                if (!document.getElementById('roombaOptionsDiv').contains(event.target)) {
                    //Still have to check if the target is in the options div because
                    // clicks with non-button 0 are not fired on the element.
                    hideOptions();
                }
            }

            function hideOptions() {
                //Hide the options dialog
                setDisplayRoombaToolipText('');
                const optionsAbsDiv = document.getElementById('roombaOptionsAbsoluteDiv');
                optionsAbsDiv.style.opacity = 0;
                optionsAbsDiv.style.pointerEvents = 'none';
                //Stop listening for window clicks to hide the options.
                window.removeEventListener('click', windowClickWhileOptionsShown, false);
            }

            function optionsTransitionend(event) {
                //Got a transitionend event.
                const optionsDiv = document.getElementById('roombaOptionsDiv');
                const optionsAbsDiv = document.getElementById('roombaOptionsAbsoluteDiv');
                if (event.target !== optionsAbsDiv) {
                    //Ignore transitions on the buttons.
                    return;
                }
                if (+optionsAbsDiv.style.opacity === 0) {
                    document.querySelector(sidebarSelector).classList.remove('roombaShowOverflow');
                    optionsAbsDiv.style.display = 'none';
                    optionsDiv.style.display = 'none';
                }
            }

            function toggleOptionDisplay(additional) {
                //Toggle the display of the options dialog
                const optionsDiv = document.getElementById('roombaOptionsDiv');
                const optionsAbsDiv = document.getElementById('roombaOptionsAbsoluteDiv');
                if (optionsDiv.style.display === 'none' || +optionsAbsDiv.style.opacity === 0) {
                    showOptions(additional);
                } else {
                    hideOptions();
                }
            }

            function handleClickEventToToggleOptionDisplay(event) {
                //Handle a click event on the Roomba status line.
                event.stopPropagation();
                toggleOptionDisplay(true);
            }

            function applyOptionsDialogStateToObject(obj) {
                //Read the state of the controls in the options dialog and apply the
                //  state to the supplied Object.
                configKeys.forEach(function(key) {
                    var el = document.getElementById('roombaOptionsCheckbox-' + key);
                    if (el) {
                        obj[key] = el.checked;
                    }
                });
            }

            function optionsSave() {
                //Handle a click on the Save button.

                function afterSaveConfig() {
                    hideOptions();
                    addOrUpdateRoomba();
                }
                applyOptionsDialogStateToObject(config);
                saveConfig().then(afterSaveConfig, afterSaveConfig);
            }

            function optionsCancel() {
                //Handle a click on the Cancel button.
                hideOptions();
                addOrUpdateRoomba();
            }

            function optionsClose() {
                //Handle a click on the Close button.
                hideOptions();
            }

            function handleOptionsClick(event) {
                //Handle a click within the div containing the actual options.
                event.stopPropagation();
                if (event.target.nodeName !== 'INPUT') {
                    //Don't want to deal with anything other than <input> elements.
                    return;
                }
                //Get an object containing the current state of the checkboxes.
                var checks = {};
                applyOptionsDialogStateToObject(checks);
                //When some options are enabled, others should be disabled.
                var currentKey = event.target.id.replace(/roombaOptionsCheckbox-/, '');
                //useToolTip and alwaysShowRoombaTable are mutually exclusive, but both may be off.
                if (currentKey === 'useTooltip' && checks.useTooltip && checks.alwaysShowRoombaTable) {
                    checks.alwaysShowRoombaTable = false;
                }
                if (currentKey === 'alwaysShowRoombaTable' && checks.alwaysShowRoombaTable && checks.useTooltip) {
                    checks.useTooltip = false;
                }
                if (currentKey === 'showShortRoombaStatus') {
                    //If enabling and useTooltip, the table will not be shown (but should not get here).
                    if (checks.showShortRoombaStatus && checks.useTooltip) {
                        checks.alwaysShowRoombaTable = false;
                    }
                    //If disabling the short status, the table must be shown.
                    if (!checks.showShortRoombaStatus) {
                        checks.alwaysShowRoombaTable = true;
                    }
                }
                if (currentKey === 'alwaysShowRoombaTable') {
                    if (!checks.alwaysShowRoombaTable && !checks.showShortRoombaStatus) {
                        //If turning off alwaysShowRoombaTable, showShortRoombaStatus must be on
                        //  This case is also effectively handled in rationalizeConfigLikeObject(checks).
                        checks.showShortRoombaStatus = true;
                    }
                }
                //Eliminate any invalid combinations.
                rationalizeConfigLikeObject(checks);
                restoreOptionsFromObject(checks);
                updateRoombaDisplayToReflectObject(checks);
            }

            function updateRoombaDisplayToReflectObject(obj) {
                //Brute force updating the display by removing and re-inserting the
                //  Roomba status row and Roomba table, then updating to current options.
                removeRoombaTableIfExists();
                removeRoombaFieldRowIfExists();
                addRoombaField();
                insertLargeRoombaTable(areShortTableHeadersNeeded(), minRoombaDays, roombaFrequency);
                populateRoombaField(downvoteWillQualify, downvoteWillQualifyByRoomba, minRoombaDays, roombaFrequency);
                document.getElementById('roombaFieldRow').insertAdjacentElement('beforebegin', document.getElementById('roombaOptionsDiv'));
                adjustDocumentToObject(obj);
                addDisplayOptionsClickListeners();
            }

            function setDisplayRoombaToolipText(value) {
                //Set the value of the display in the style attribute for all roombaToolTipText elements.
                setDisplayQuery('.roombaTooltipText', value);
            }

            function setDisplayQuery(query, value) {
                //Set the value of the display in the style attribute for all elements matching a query.
                setAStyleQuery('display', query, value);
            }

            function setAStyleQuery(style, query, value) {
                //Set the value of the a specified style in the style attribute for all elements matching a query.
                asArray(document.querySelectorAll(query)).forEach(function(el) {
                    el.style[style] = value;
                });
            }

            function adjustDocumentToConfig() {
                //Make changes to the DOM to implement the options specified in the config.
                adjustDocumentToObject(config);
            }

            function adjustDocumentToObject(obj) {
                //Make changes to the DOM to implement the options specified in the object.
                var roombaTableDiv = document.querySelector('#roombaTableDiv');
                var roombaTableDivDiv = document.querySelector('#roombaTableDivDiv');
                if (obj.useTooltip) {
                    //Using the tooltip.
                    //Apply tooltip classes
                    roombaTableDivDiv.classList.add('roombaTooltipText');
                    roombaTableDiv.classList.add('roombaTooltipTextPositionDiv');
                    //Move the Roomba table to be the first child of the first td inside the row of the .roombaTooltip class is on.
                    const tooltipTd = document.getElementById('roombaFieldRowLabel');
                    tooltipTd.insertBefore(roombaTableDiv, tooltipTd.firstChild);
                    //We could remove the mr16 class from the roombaFieldRow here,
                    //  but having it doesn't appear to be causing an issue and
                    //  removing it might if there's another entry on the line
                    //  which was added by some other userscript.
                    /*
                    if (isViewsBelowTitle) {
                        const fieldRow = document.getElementById('roombaFieldRow');
                        fieldRow.classList.remove('mr16');
                    }
                    */
                } else if (!obj.alwaysShowRoombaTable) {
                    //Don't show the Roomba Table. Only apply this if not a tooltip.
                    roombaTableDiv.style.display = 'none';
                }
                if (!obj.showShortReasons) {
                    //Don't show the short reasons.
                    const reasonsCell = document.querySelector('#roombaShortReasonsSpan');
                    if (reasonsCell) {
                        reasonsCell.style.display = 'none';
                        const reasonsCellParent = reasonsCell.parentElement;
                        if (reasonsCellParent.classList.contains('roombaReasonsCell') && reasonsCellParent.innerText.trim() === '') {
                            reasonsCellParent.style.display = 'none';
                        }
                    }
                }
                if (!obj.showIfDownvoteWillRoomba) {
                    //Don't show that a downvote on the question and/or answer(s) will qualify for Roomba.
                    var roombaDownvote = document.querySelector('#roombaDownVoteQualifies');
                    if (roombaDownvote) {
                        roombaDownvote.style.display = 'none';
                    }
                }
                hideShortRoombaStatusIfConfiguredInObject(obj);
            }

            function areShortTableHeadersNeeded() {
                //See if the short table headers are needed (the close Roomba) in order to fit
                //  the table within the 300px of the sidebar.
                return roombas.some(function(curRoomba) {
                    var headerLength = curRoomba.headerText.replace(/&nbsp;/ig, ' ').length;
                    headerLength = Math.max(headerLength, 11); //Fudge factor: 11
                    return curRoomba.reasons.some(function(reason) {
                        if (/<br\s*\/*>/i.test(reason)) {
                            //If the reason has a <br> in it, then it already accounts for length
                            return false;
                        }
                        var reasonLength = reason.replace(/&nbsp;/ig, ' ').length;
                        if (reasonLength > headerLength) {
                            return true;
                        }
                        return false;
                    });
                });
            }

            //Begin processing the response

            if (!config.scrapePage || mustUseAPI) {
                //Handle some possible conditions with the API.
                if (data.quota_remaining < 1000) {
                    //Report in the console that the number of remaining requests is limited.
                    console.log('Quota remaining:', data.quota_remaining);
                }
                if (!mustUseAPI && !question && (data.quota_remaining < 10 || data.backoff || data.error_id)) {
                    //Start using page scraping if:
                    //  The API quota is nearly consumed.
                    //  The API indicated we should back-off.
                    //  Any other API error.
                    console.log('Encountered an API problem. Retrying with page scraping: data:', data);
                    config.scrapePage = true;
                    addOrUpdateRoomba();
                    return;
                }
            }
            if (typeof question === 'undefined') {
                //No question data indicates the question is already deleted.
                document.getElementById(roombaFieldId).innerHTML = '<B>already deleted</B>';
                insertLargeRoombaTable(areShortTableHeadersNeeded(), minRoombaDays, roombaFrequency);
                insertRoombaForecasterOptionsDialog();
                adjustDocumentToConfig();
                return;
            }

            //Calculate some values for the question which are used in later processing.
            computeExtraQuestionData(question);

            //Test the question for each Roomba. Track if the user downvoting can affect the Roomba status.
            downvoteWillQualify = 0; //Used as a bit field with values: 0,1,2,3
            roombas.forEach(function(curRoomba) {
                const currentResult = testCriteriaAndMakeHtml(curRoomba);
                downvoteWillQualifyByRoomba[curRoomba.shortReasonPrefix] = currentResult;
                downvoteWillQualify |= currentResult; // eslint-disable-line no-bitwise
            });

            //Get the minimum number of days to a Roomba and the frequency.
            //First, determine the minimum number of days
            roombas.forEach(function(curRoomba) {
                minRoombaDays = Math.min(curRoomba.remainingDays, minRoombaDays);
            });
            //Then get the matching frequency, which may have multiple matches, but daily is the priority over weekly.
            roombas.forEach(function(curRoomba) {
                if (roombaFrequency !== 'daily' && minRoombaDays === curRoomba.remainingDays) {
                    roombaFrequency = curRoomba.frequency;
                }
            });

            //Insert the rest of the Roomba Forecaster UI into the DOM.
            insertLargeRoombaTable(areShortTableHeadersNeeded(), minRoombaDays, roombaFrequency);
            populateRoombaField(downvoteWillQualify, downvoteWillQualifyByRoomba, minRoombaDays, roombaFrequency);
            insertRoombaForecasterOptionsDialog();
            adjustDocumentToConfig();
        });
    }
})();