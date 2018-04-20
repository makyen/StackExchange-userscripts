// ==UserScript==
// @name          Left-sidebar in the Topbar
// @description   Put the left-sidebar in the topbar.
// @author        Makyen
// @namespace     MakyenStackExchangeAdjustments
// @match         *://stackoverflow.com/*
// @version       1.0.1
// @grant         none
// @run-at        document-start
// ==/UserScript==

(function() {
    'use strict';

    const nameSpace = 'makyen-SE-left-sidebar-in-topbar-';
    const useOriginalSEWidth = false;
    const leftSidebarFirst = true;

    //Add the styles for the left-sidebar in the topbar
    const leftSidebarInTopbar = `
        .top-bar .makyen-left-sidebar-container {
            margin-left: 1.0vw;
            margin-right: 0.5vw;
            position:relative;
        }
        .top-bar .makyen-sidebar-icon-container {
            border-bottom: 3px solid #F48024;
            border-right-width: 0px;
            height: 46px;
            position: relative;
        }
        .top-bar .makyen-sidebar-icon-container .-link {
            height: 44px;
        }
        .top-bar .makyen-sidebar-icon-container > * {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translateX(-50%) translateY(-50%);
            -webkit-transform: translateX(-50%) translateY(-50%);
            -ms-transform: translateX(-50%) translateY(-50%);
        }
        .top-bar .left-sidebar {
            background-color:#fff;
            margin-top: 1px;
        }
        .top-bar .left-sidebar.left-sidebar > nav {
            height: auto !important;
        }
        body > .container #content, body > .container._full #content {
            margin: 0 auto;
        }
        body > .container {
            width: 100%;
        }
        body > .container #content .left-sidebar {
            width: 0px !important;
            height: 0px !important;
            display: none !important;
        }
        `;

    function moveLeftNavIntoTopbar() {
        //Move the .left-sidebar into an appropriate structure in the top-bar.
        //  A dummy .left-sidebar is left in it's place, because some SE CSS depends on it's existence.
        const header = document.querySelector('.top-bar');
        const sidebar = document.querySelector('.left-sidebar');
        if (!sidebar) {
            if (!header) {
                return false;
            } // else
            if (header && !header.classList.contains('_with-left-nav')) {
                //This isn't a left-nav page, so we stop looking
                return true;
            }
            return false;
        }
        setClassIndicatingYouarehere();
        if (!useOriginalSEWidth) {
            //Leave a duplicate wrapper div, as some SE CSS depends on it.
            sidebar.insertAdjacentHTML('beforebegin', '<div class="left-sidebar left-sidebar-improvements" style="display:none;">');
        }
        if (useOriginalSEWidth) {
            header.classList.remove('_with-left-nav');
        }
        const headContainter = getFirstChildWithClass(header, '-container');
        const headerMain = getFirstChildWithClass(headContainter, '-main');
        const mainLogo = getFirstChildWithClass(headerMain, '-logo');
        const sidebarContainer = document.createElement('div');
        sidebarContainer.classList.add('makyen-left-sidebar-container');
        const sidebarNav = getFirstMatchingChild(sidebar, 'nav');
        const thisIs = sidebar.querySelector('.thisisYouarehere');
        let icon = thisIs.querySelector('svg, .s-avatar');
        if (!icon) {
            const toss = document.createElement('div');
            toss.innerHTML = `
                <svg aria-hidden="true" class="svg-icon" width="18" height="18" viewbox="0 0 18 18">
                    <path d="M 0,2 0,5 4,5 4,2 Z m 7,0 0,3 11,0 0,-3 z m -7,6 0,3 4,0 0,-3 z m 7,0 0,3 11,0 0,-3 z m -7,6 0,3 4,0 0,-3 z m 7,0 0,3 11,0 0,-3 z"/>
                </svg>
            `;
            icon = toss.querySelector('svg');
        }
        const cloneIcon = icon.cloneNode(true);
        sidebarContainer.insertAdjacentHTML('afterbegin', '<div class="makyen-sidebar-icon-container secondary-nav"><div class="-item"><div class="-link"></div></div></div>');
        const iconContainer = getFirstChildWithClass(sidebarContainer, 'makyen-sidebar-icon-container');
        const iconLink = iconContainer.querySelector('.-link');
        iconContainer.classList.add('themed-bd');
        iconLink.appendChild(cloneIcon);
        const matches = ((thisIs.querySelector('a') || {}).className || '').match(/channel\d+/);
        if (matches) {
            iconContainer.classList.add(matches[0]);
        }
        sidebarContainer.appendChild(sidebar);
        if (leftSidebarFirst) {
            //Put the sidebar first:
            headContainter.insertBefore(sidebarContainer, headContainter.firstChild);
        } else {
            //Put the sidebar after the main logo:
            mainLogo.parentNode.insertBefore(sidebarContainer, mainLogo.nextSibling);
        }

        function leftSidebarClose() {
            //Close the left-sidebar as drop-down.
            sidebar.classList.remove('makyen-open');
            sidebar.classList.remove('topbar-dialog');
            iconLink.classList.remove('topbar-icon-on');
            sidebar.style.display = 'none';
        }
        let windowSidebarCloseTimer = 0;
        window.addEventListener('click', () => {
            clearTimeout(windowSidebarCloseTimer);
            windowSidebarCloseTimer = setTimeout(leftSidebarClose, 0);
        }, true);
        sidebarContainer.addEventListener('click', (event) => {
            if (!sidebar.classList.contains('makyen-open')) {
                sidebar.classList.add('makyen-open');
                sidebar.classList.add('topbar-dialog');
                iconLink.classList.add('topbar-icon-on');
                sidebar.style.display = '';
            } else if (!sidebarNav.contains(event.target)) {
                leftSidebarClose();
            }
            clearTimeout(windowSidebarCloseTimer);
        });
        leftSidebarClose();
        return true;
    }

    function setClassIndicatingYouarehere() {
        //Set the classes on the icon displayed in the topbar which cause the appropriate icon to be displayed.
        //  This is, somewhat, left over from not having a separate icon. It probably could be cleaned up, but
        //  it's working.
        const sidebar = (document.getElementsByClassName('left-sidebar') || [null])[0];
        if (!sidebar) {
            return false;
        }
        let isHere = sidebar.querySelector('.youarehere');
        if (!isHere) {
            if (window.location.hostname === 'stackoverflow.com') {
                const path = window.location.pathname;
                let href = '/questions';
                if (path.startsWith('/c/')) {
                    href = path.replace(/^(\/c\/\w+)\/.*$/, '$1/questions');
                }
                isHere = sidebar.querySelector('a[href="' + href + '"]');
            }
        }
        if (isHere) {
            const hereItem = getClosestMatchingParent(isHere, '.-item'); //It should be the same element
            var thisIs = hereItem;
            while (thisIs && !getFirstChildWithClass(thisIs, 'pl8')) {
                thisIs = thisIs.previousSibling;
            }
            let link = null;
            if (thisIs) {
                thisIs.classList.add('thisisYouarehere');
                link = thisIs.querySelector('a');
            }
            const isHereLink = isHere.querySelector('a');
            const matches = (isHereLink ? isHereLink.className : '').match(/channel\d+/);
            if (link) {
                link.classList.add('themed-bd');
                if (matches) {
                    link.classList.add(matches[0]);
                }
            }
        }
        return true;
    }

    function addCssStyleTextToDom(id, cssText) {
        //Add CSS as new element to the end of the documentElement.
        // Can be used prior to the page HTML loading. If added after the existence of <body>
        // it gives it priority over duplicate rules normally included in the HTML.
        //Create the new element
        const newStyle = document.createElement('style');
        newStyle.setAttribute('type', 'text/css');
        newStyle.id = nameSpace + id;
        newStyle.textContent = '\n' + cssText;
        //Make sure there this is not double-adding the style
        removeNameSpacedElementFromDom(id);
        document.documentElement.appendChild(newStyle);
    }

    function removeNameSpacedElementFromDom(id) {
        //Remove an element from the DOM by id, which was added with our nameSpace.
        const oldStyle = document.getElementById(nameSpace + id);
        if (oldStyle) {
            oldStyle.parentNode.removeChild(oldStyle);
        }
    }

    function getClosestMatchingParent(element, selector) {
        //Find the closest ancestor, including the element itself which matches the selector.
        while (element && !element.matches(selector)) {
            element = element.parentNode;
        }
        return element;
    }

    function getFirstMatchingChild(element, childSelector) {
        //Return the first immediate child of the element which matches the  selector.
        if (element) {
            const nodes = element.childNodes;
            if (nodes && nodes.length > 0) {
                for (let index = 0; index < nodes.length; index++) {
                    const node = nodes[index];
                    if (node.nodeName !== '#text' && node.matches(childSelector)) {
                        return node;
                    }
                }
            }
        }
        return null;
    }

    function getFirstChildWithClass(element, childClass) {
        //Return the first immediate child of the element which has the specified class (faster than matching selectors).
        if (element) {
            const nodes = element.childNodes;
            if (nodes && nodes.length > 0) {
                for (let index = 0; index < nodes.length; index++) {
                    const node = nodes[index];
                    if (node.nodeName !== '#text' && node.classList.contains(childClass)) {
                        return node;
                    }
                }
            }
        }
        return null;
    }

    //Copied from author's Top-Nav Choices, and modified

    function doTasksRequiringChildElement(toObserve, childSelector, callback) {
        //Observe document.body for elements. Run the callback when the .container (first after the top-bar) exists.
        //  This results in the callback running immediately after the top-bar exists.
        var childObserver;

        function executeIfAChildMatches() {
            const child = getFirstMatchingChild(toObserve, childSelector);
            if (child) {
                //There is a child that matches.
                if (childObserver && typeof childObserver.disconnect === 'function') {
                    //We did create an Observer, so disconnect.
                    childObserver.disconnect();
                }
                callback(child);
                return true;
            }
            return false;
        }
        if (!executeIfAChildMatches()) {
            childObserver = new MutationObserver(executeIfAChildMatches);
            childObserver.observe(toObserve, {
                childList: true,
            });
        }
    }

    function addCssPreDom() {
        //Add CSS changes that can be made prior to the DOM being loaded.
        //  This can not include any CSS which must be changed or loaded/not loaded
        //  based on the DOM. This is only CSS which can be loaded on every page.
        addCssStyleTextToDom('leftSidebarInTopbar', leftSidebarInTopbar);
    }

    function doNTimesAtTIntervalsUntilTrue(callback, tries, delay, timerObject) {
        //Executes the callback immediately, then potentially up to 'tries' times with a delay of
        //  'delay' between attempts until a truthy value is returned from the callback.
        if (!callback()) {
            tries--;
            if (typeof timerObject !== 'object' || !timerObject) {
                timerObject = {};
            }
            if (tries > 0) {
                timerObject.timer = setTimeout(doNTimesAtTIntervalsUntilTrue, delay, callback, tries, delay, timerObject);
            }
        }
    }

    function whenBodyExists() {
        // Code to execute when the <body> exists.
        addCssPreDom();
        //There are tasks which require that additional elements exist inside the <body>.
        doTasksRequiringChildElement(document.body, '.container', (container) => {
            //We are going to manipulate the .left-sidebar. Thus, we wait until the element which comes
            //  immediately after it exists in the DOM. This makes it likely that the .left-sidebar exists prior
            //  to our trying to manipulate it. We should probably actually test for it's existence, in addition.
            doTasksRequiringChildElement(container, '#content', () => {
                moveLeftNavIntoTopbar();
            });
        });
    }

    var observerForBody;
    var bodyObserverBackupTimer = {};

    function doTasksIfBody() {
        //Test for the existence of <body> and execute whenBodyExists() when it does.
        //  This is called by both a timer (needed for Edge) and a MutationObserver (so that we're fast in other browsers).
        if (document.body !== null) {
            if (observerForBody && typeof observerForBody.disconnect === 'function') {
                observerForBody.disconnect();
            }
            whenBodyExists();
            clearTimeout(bodyObserverBackupTimer.timer);
            return true;
        }
        return false;
    }

    function doTasksRequiringBody() {
        //Observe document.documentElement for the <body>. When it exists, run the tasks which
        //  require it.
        if (document.body === null) {
            if (typeof observerForBody !== 'object' || observerForBody === null) {
                //This MutationObserver doesn't work in Edge.
                observerForBody = new MutationObserver(doTasksIfBody);
                observerForBody.observe(document.documentElement, {
                    childList: true,
                });
                //Edge doesn't handle documentElement MutationObservers, or at least not the same way as Chrome and Firefox.
                //Thus, we also use a backup timer looking for the body. It doesn't hurt to have this in other browsers,
                //  as the MutationObserver will fire first and the check for body is trivial.
                doNTimesAtTIntervalsUntilTrue(doTasksIfBody, 100, 100, bodyObserverBackupTimer);
            }
        } else {
            whenBodyExists();
        }
    }

    //The CSS is added now to minimize having the display jump around when it's applied. It's also added
    //  and after the body exists, which moves the CSS to the end of the document in order to provide priority.
    addCssPreDom();
    doTasksRequiringBody();
})();