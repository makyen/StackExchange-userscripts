// ==UserScript==
// @name          Left-sidebar in the Topbar
// @description   Put the left-sidebar in the topbar.
// @author        Makyen
// @namespace     MakyenStackExchangeAdjustments
// @match         *://*.stackoverflow.com/*
// @match         *://*.superuser.com/*
// @match         *://*.serverfault.com/*
// @match         *://*.askubuntu.com/*
// @match         *://*.stackapps.com/*
// @match         *://*.mathoverflow.net/*
// @match         *://*.stackexchange.com/*
// @exclude       *://chat.stackoverflow.com/*
// @exclude       *://chat.stackexchange.com/*
// @exclude       *://chat.*.stackexchange.com/*
// @exclude       *://api.*.stackexchange.com/*
// @exclude       *://data.stackexchange.com/*
// @version       2.0.0
// @grant         none
// @run-at        document-start
// ==/UserScript==
/* globals StackExchange */

(function() {
    'use strict';
    document.documentElement.classList.add('html__unpinned-leftnav');
    let calledSEReady = false;

    function toggleLeftNavOnAndOffAgainWhenPossible(count) {
        if (typeof StackExchange === 'object' && StackExchange.topbar && typeof StackExchange.topbar.toggleUnpinnedLeftNav === 'function') {
            StackExchange.topbar.toggleUnpinnedLeftNav(false);
            StackExchange.topbar.toggleUnpinnedLeftNav(true);
        } else {
            count = count ? count + 1 : 1;
            if (!calledSEReady && typeof StackExchange === 'object' && typeof StackExchange.ready === 'function') {
                StackExchange.ready(toggleLeftNavOnAndOffAgainWhenPossible);
                calledSEReady = true;
            } else if (count < 120) {
                setTimeout(toggleLeftNavOnAndOffAgainWhenPossible, 100 * (count < 20 ? 1 : 10), count);
            }
        }
    }
    toggleLeftNavOnAndOffAgainWhenPossible(1);
})();
