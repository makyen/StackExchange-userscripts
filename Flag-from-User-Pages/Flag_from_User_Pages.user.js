// ==UserScript==
// @name          Flag from User Pages
// @namespace     MakyenStackExchangeAdjustments
// @description   Add a flag link that opens the flag dialog for posts in a user's profile.
// @author        Makyen
// @match         *://stackoverflow.com/users/*
// @match         *://meta.stackoverflow.com/users/*
// @match         *://superuser.com/users/*
// @match         *://meta.superuser.com/users/*
// @match         *://serverfault.com/users/*
// @match         *://meta.serverfault.com/users/*
// @match         *://askubuntu.com/users/*
// @match         *://meta.askubuntu.com/users/*
// @match         *://stackapps.com/users/*
// @match         *://*.stackexchange.com/users/*
// @exclude       *://chat.stackexchange.com/*
// @exclude       *://chat.*.stackexchange.com/*
// @exclude       *://api.*.stackexchange.com/*
// @exclude       *://data.stackexchange.com/*
// @version       1.0.0
// @grant         none
// ==/UserScript==
/* globals StackExchange */

(function() {
    'use strict';

    function addFlags() {
        const now = Date.now();
        ['question', 'answer'].forEach((type) => {
            $('a.' + type + '-hyperlink').each(function() {
                const $this = $(this);
                const currentFlag = $this.parent().find('.flag-post-link');
                if (!currentFlag.length) {
                    const href = $this.attr('href');
                    if (href) {
                        const matches = type === 'answer' ? href.match(/^.*#(\d+)$/) : href.match(/^\/q(?:uestions)?\/(\d+)\/.*$/);
                        if (matches && matches[1]) {
                            const postId = matches[1];
                            $this.before('<a href="#" class="flag-post-link" title="flag this post for serious problems or moderator attention" data-postid="' + postId + '" style="margin-left:1em;margin-right:1em;display:inline;width:auto;">&#9873;</a>').css('display', 'inline');
                            $this.parent().find('.flag-post-link').data({
                                postid: postId,
                                loadedTimestamp: now,
                            });
                        }
                    }
                }
            });
        });
    }
    $(document).ajaxComplete(addFlags);
    addFlags();
    StackExchange.ready(() => StackExchange.vote_closingAndFlagging.init());
})();