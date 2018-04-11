// ==UserScript==
// @name          SE Chat Scroll the Starboard
// @description   Make the starboard scrolling to display a larger number of messages.
// @namespace     MakyenStackExchangeChatAdjustments
// @author        Makyen
// @match         *://chat.stackoverflow.com/rooms/*
// @match         *://chat.stackexchange.com/rooms/*
// @match         *://chat.meta.stackexchange.com/rooms/*
// @version       1.0.0
// @grant         none
// ==/UserScript==
/* globals CHAT */

(function() {
    'use strict';

    //This adjusts the starboard in the chat sidebar to use scrolling. Unfortunately, this area did not appear
    //  to accept being set to flex, so the height of the starboard area is manually adjusted when the area
    //  available changes.
    const inputAreaEl = document.getElementById('input-area');
    const chatEl = document.getElementById('chat');
    const sidebar = document.getElementById('sidebar');
    const starredPosts = document.getElementById('starred-posts');
    const starredPostsParent = starredPosts.parentNode;
    starredPostsParent.style.overflowY = 'auto';

    function clickShowMoreStaredPosts() {
        //Click the button to show more starred posts.
        if (chatEl) {
            const moreStarred = starredPostsParent.querySelector('.more');
            if (moreStarred && !/\b1\b/.test(moreStarred.textContent)) {
                moreStarred.click();
            }
        }
    }

    function adjustChatStarHeight() {
        //Adjust the height of the starred posts container so it fits above the bottom input-area.
        if (chatEl) {
            const inputAreaElRec = inputAreaEl.getBoundingClientRect();
            const starredDivRec = starredPostsParent.getBoundingClientRect();
            starredPostsParent.style.height = inputAreaElRec.y - (starredDivRec.y + 25) + 'px';
        }
    }

    //Debounce calls to adjustChatStarHeight, so they happen only after 100ms of being idle.
    //This implementation results in at least a 100ms delay in adjusting the star height after
    //  no activity. This requested delay can be as much as 200ms (but could be longer).
    let debounceTimer = 0;
    let debounceWasCalled = false;

    function debounceAdjustingStarHeight() {
        //Start a timer for debouncing calls to adjust the start height.
        if (debounceTimer === 0) {
            //If this function wasn't called while the timer is active, activate the timer.
            debounceWasCalled = false;
            debounceTimer = setTimeout(debounceTimerComplete, 100);
            return;
        }
        debounceWasCalled = true;
    }

    function debounceTimerComplete() {
        //The timer is complete. If there was no activity, adjust the star height. If there was, restart the timer.
        debounceTimer = 0;
        if (debounceWasCalled) {
            debounceAdjustingStarHeight();
        } else {
            adjustChatStarHeight();
        }
    }

    function adjustStarHeightAfterChatEvent() {
        //Adjust the height 2 and 4 seconds after CHAT events. CHAT events could indicate that the other portions of
        //  the sidebar change size, which causes the space available for the starboard to change.
        setTimeout(adjustChatStarHeight, 2000);
        setTimeout(adjustChatStarHeight, 4000);
    }

    function multiCallAdjustStarHeight() {
        //Some clicks in the sidebar can result in significant change in size of the available space in the starboard.
        //  The change in size is animated. This just makes adjustments on a rapid basis after a click, in case there
        //  is a change in size. This could be significantly optimized, but action is rare.
        for (let delay = 50; delay < 1100; delay += 50) {
            setTimeout(adjustChatStarHeight, delay);
        }
    }

    if (chatEl) {
        setTimeout(() => {
            //Show all the available starred posts and adjust the height. Delayed to be after the page is available. This
            //  could be optimized to actually detect when that is the case.
            clickShowMoreStaredPosts();
            adjustChatStarHeight();
        }, 5000);
        //Monitor various events which can change the size of the starboard. A MutationObserver might be more appropriate, but a
        //  general one is triggered too often. It would take work to determine the minimum which would need to be monitored.
        sidebar.addEventListener('click', multiCallAdjustStarHeight, true);
        //Resizing the window will, of course, affect the sideboard size.
        window.addEventListener('resize', adjustChatStarHeight, true);
        //Messages are used by chat, among other things, to announce that the page has gone from not being visible to being visible.
        //  This is debounced, because there is no information as to what else might be triggering such messages, and we don't want
        //  the possibility of repeated calling to be that rapid.
        window.addEventListener('message', debounceAdjustingStarHeight, true);
        CHAT.addEventHandlerHook(adjustStarHeightAfterChatEvent);
        adjustChatStarHeight();
    }
})();