// ==UserScript==
// @name         Stack Exchange Top Nav Choices
// @author       Makyen
// @namespace    MakyenStackExchangeTopNavChoices
// @description  Adds various choices to how the new Stack Exchange top navigation is displayed
// @include      /^https?:\/\/([^/]*\.)?stackoverflow.com/.*$/
// @include      /^https?:\/\/([^/]*\.)?serverfault.com/.*$/
// @include      /^https?:\/\/([^/]*\.)?superuser.com/.*$/
// @include      /^https?:\/\/([^/]*\.)?stackexchange.com/.*$/
// @include      /^https?:\/\/([^/]*\.)?askubuntu.com/.*$/
// @include      /^https?:\/\/([^/]*\.)?stackapps.com/.*$/
// @include      /^https?:\/\/([^/]*\.)?mathoverflow\.net/.*$/
// @exclude      *://chat.stackexchange.com/*
// @exclude      *://chat.*.stackexchange.com/*
// @exclude      *://api.*.stackexchange.com/*
// @exclude      *://data.stackexchange.com/*
// @version      1.0.1
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @run-at       document-start
// ==/UserScript==
/* globals GM_getValue, GM_setValue, GM_addValueChangeListener */

(function() {
    'use strict';

    var nameSpace = 'makyenTopNavChoices-';
    var topNavQualifier = '.' + nameSpace + 'top-nav';
    var isSO = /(?:^|\.)stackoverflow\.com$/.test(window.location.hostname);
    var isMetaSO = window.location.hostname === 'meta.stackoverflow.com';
    var secondaryNavAfterLogo;
    var secondaryNavBeforeSearch;
    var originalNav;
    var header;
    var listItems = {
        unknown: []
    };
    var moveOrder = ['inbox', 'achievements', 'review', 'help', 'hamburger'];
    var originalJobsText;
    var originalHelpButtonState;
    if (document.readyState === 'loading') {
        doTasksRequiringBody();
        window.addEventListener('DOMContentLoaded', afterLoaded);
    } else {
        doTasksRequiringBody();
        afterLoaded();
    }
    var currentUserHref;
    var currentUserId;
    var canListenGMStorage = typeof GM_addValueChangeListener === 'function'; //Not available: Greasemonkey


    //Options
    function CheckboxOption(_defaultValue, _text, _tooltip) {
        //Constructor for a checkbox option
        this.defaultValue = _defaultValue;
        this.text = _text;
        this.tooltip = _tooltip;
    }

    function LocationOption(_defaultValue, _text, _tooltip) {
        //Constructor for a Location option
        RadioOption.call(this, _defaultValue, [
            new CheckboxOption( 1, 'left',   'Place this item on the left.'),
            new CheckboxOption( 5, 'center', 'Place this item in the center.'),
            new CheckboxOption(10, 'right',  'Place this item on the right.'),
        ], _text, _tooltip);
    }

    function RadioOption(_defaultValue, _radios, _text, _tooltip) {
        //Constructor for a radio option
        this.defaultValue = _defaultValue;
        this.radios = _radios;
        this.text = _text;
        this.tooltip = _tooltip;
    }

    /* Not used
    function ButtonOption(_buttonAction, _dynamicText, _text, _tooltip) {
        //Constructor for a button option
        this.buttonAction = _buttonAction;
        this.dynamicText = _dynamicText;
        this.text = _text;
        this.tooltip = _tooltip;
    }
    */

    function NumberOption(_defaultValue, _min, _max, _style, _textPre, _textPost, _tooltip) {
        //Constructor for a number option
        this.defaultValue = _defaultValue;
        this.min = _min;
        this.max = _max;
        this.style = _style;
        this.textPre = _textPre;
        this.textPost = _textPost;
        this.tooltip = _tooltip;
    }

    /* beautify preserve:start */
    var heightAdjustmentTooltipExtraText = '\r\nCurrently, the center items are just separated using &quot;margin-left&quot;/&quot;margin-right&quot;.\r\nThis is how many pixels are between the centered items and the search box. Large values will make the search box smaller.\r\nThe default values of 50, 50 (SO/MSO) and 185, 50 (others) will result in a single centered item being in close to the same centered location on SO/MSO and MSE.\r\nWhen more sites start using the new top-nav how this is adjusted may be revisited in order to let you have a centered item in about the same place across sites.';
    var tooltipAppliesToSO    = 'This value applies on Stack Overflow and Meta Stack Overflow.';
    var tooltipAppliesToOther = 'This value applies on sites that are not Stack Overflow or Meta Stack Overflow.';
    //Object describing the options displayed in the GUI.
    var knownOptions = {
        checkboxes: {
            consolidateHamburger:            new CheckboxOption(true,  'Merge the Site Switcher with the site logo (on the left).', ''),
            darkTopNavOnSO:                  new CheckboxOption(true,  'Dark Top-Nav theme on Stack Overflow and Meta Stack Overflow.', ''),
            sticky:                          new CheckboxOption(false, 'Sticky Top-Nav (all sites with new navigation).', ''),
            addHelp:                         new CheckboxOption(true,  'Add the help button if it\'s not already displayed.', ''),
            useJobsForJobsText:              new CheckboxOption(true,  'On Stack Overflow, show "Jobs" instead of "Developer Jobs".', ''),
            showOrangeTopSO:                 new CheckboxOption(false, 'Show the orange line along the top of the Top-Nav on Stack Overflow/Meta Stack Overflow.', ''),
            useNarrowNavSO:                  new CheckboxOption(true,  'Narrow the space taken by "Questions", etc. on Stack Overflow/Meta Stack Overflow.', ''),
            applyTopNavHeightToNonSO:        new CheckboxOption(true,  'Apply the selected height to sites other than Stack Overflow/Meta Stack Overflow.', 'The stock top navigation is a different height on sites other (40px) than SO/MSO (60px). Selecting this will apply the height you have selected to all sites with the new top navigation. If you don\'t select this checkbox, then the height you select here will apply to only Stack Overflow and it\'s meta.'),
        },
        locations: {
            inbox:         new LocationOption( 1, 'Inbox', ''),
            achievements:  new LocationOption( 1, 'Achievements', ''),
            review:        new LocationOption(10, 'Reviews', ''),
            help:          new LocationOption(10, 'Help', ''),
            hamburger:     new LocationOption(10, 'Site Switcher', 'Not used if the site switcher is consolidated with the site logo.'),
            unknown:       new LocationOption( 5, 'Other (moderator tools?)', 'This will probably be moderator tools. May not properly adjust any drop-down menu.'),
        },
        /*
        buttons: {
            someButton:             new ButtonOption(actionFunction, dynamicTextFunction, 'displayed text', 'tooltip'),
        },
        */
        numbers: {
            centerMarginLeftSO:     new NumberOption( 50, 0, 500, 'width: 5em;height:2em;', 'Stack Overflow: Left margin ',  ' (px) center drop down ', tooltipAppliesToSO + heightAdjustmentTooltipExtraText),
            centerMarginRightSO:    new NumberOption( 50, 0, 500, 'width: 5em;height:2em;', '', ' (px) Right margin', tooltipAppliesToSO + heightAdjustmentTooltipExtraText),
            centerMarginLeftNonSO:  new NumberOption(185, 0, 500, 'width: 5em;height:2em;', 'Non-SO: Left margin ',  ' (px) center drop down ', tooltipAppliesToOther + heightAdjustmentTooltipExtraText),
            centerMarginRightNonSO: new NumberOption( 50, 0, 500, 'width: 5em;height:2em;', '', ' (px) Right margin', tooltipAppliesToOther + heightAdjustmentTooltipExtraText),
            topNavHeight:           new NumberOption( 34, 0, 500, 'width: 5em;height:2em;', 'Top-Nav height ', ' px', 'The original top-nav on most sites is/was 34px high. The new top-nav on SO/MSO is 60px. The new top-nav on MSE is 40px. It\'s assumed that other sites will be 40px high when they get the new top-nav. This allows you to set it to what you desire. There is a checkbox that allows you to apply this selection only to SO/MSO or to all sites with the new top-nav.'),
        },
    };
    /* beautify preserve:end */

    //Testing: clear options:
    //GM_deleteValue('configOptions');
    var configOptions = getConfigOptions();
    var topNavHeight;

    function setTopHeightByConfig() {
        //Set the global topNavHeight by the current configuration.
        topNavHeight = configOptions.numbers.topNavHeight;
        if (!isSO && !configOptions.checkboxes.applyTopNavHeightToNonSO) {
            topNavHeight = 40;
        }
    }
    setTopHeightByConfig();


    function KnownItem(_container, _link, _dialogClass) {
        //Constructor for top-nav items
        this.container = _container;
        this.link = _link;
        this.dialogClass = _dialogClass;
    }

    function addNoTopOrange() {
        //Add CSS to remove the top orange bar on SO.
        if (configOptions.checkboxes.showOrangeTopSO) {
            removeNameSpacedElementFromDom('NoTopOrange');
            return;
        }
        let css = '' +
            topNavQualifier + '.top-bar {\n' +
            '    border-top: 0px;\n' +
            '}\n' +
            '';
        addCssStyleTextToDom('NoTopOrange', css);
    }

    function addShortTopNav(height) {
        //Add CSS to adjust the height of the top-nav.
        //  The height also affect other CSS, so this is not the only thing that needs to be done.
        let css = '' +
            topNavQualifier + '.top-bar {\n' +
            '    height: ' + height + 'px;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .navigation .beta-badge {\n' +
            '    top: 21px;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .-actions{\n' +
            '    margin-left: 10px;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .-logo{\n' +
            '    height: ' + height + 'px;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .navigation .-list {\n' +
            '    height: auto;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .navigation .-link {\n' +
            '    height: auto;\n' +
            '    line-height: ' + (height - (2 + ((configOptions.checkboxes.showOrangeTopSO && isSO) ? 3 : 0))) + 'px;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .searchbar input.f-input[type="text"] {\n' +
            '    height: auto;\n' +
            '    padding-top: 2px;\n' +
            '    padding-bottom: 2px;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .searchbar .btn-topbar-primary ,\n' +
            topNavQualifier + '.top-bar .searchbar .btn {\n' +
            '    min-height: auto;\n' +
            //This will probably take some adjustment for other heights.
            //  It works for various top-nav heights (24px value).
            //  Doesn't appear to need to change by height.
            '    height: ' + (24) + 'px;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .searchbar .js-search-submit svg {\n' +
            '    position: absolute;\n' +
            '    top: 3px;\n' +
            '    right: 7px;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .secondary-nav .-list {\n' +
            '    height: auto;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .secondary-nav .-link {\n' +
            '    height: auto;\n' +
            '    line-height: ' + (height - (2 + ((configOptions.checkboxes.showOrangeTopSO && isSO) ? 3 : 0))) + 'px;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .secondary-nav .-link .indicator-badge:not(._regular) {\n' +
            '    top: 0px !important;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .my-profile {\n' +
            '    height: ' + height + 'px;\n' +
            '}\n' +
            topNavQualifier + '.topbar-dialog,\n' +
            topNavQualifier + '.topbar-dialog.inbox-dialog,\n' +
            topNavQualifier + '.topbar-dialog.achievements-dialog,n' +
            topNavQualifier + '.topbar-dialog.help-dialog,\n' +
            topNavQualifier + '.topbar-dialog.review-dialog,\n' +
            topNavQualifier + '.topbar-dialog.siteSwitcher-dialog {\n' +
            '    top: ' + height + 'px !important;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .navigation .-item .-link {\n' +
            '    transition: background .3s, color .3s, border .3s;\n' +
            '}\n' +
            topNavQualifier + '.top-bar ~ .container {\n' +
            '    margin-top: ' + height + 'px;\n' +
            '}\n' +
            //Bug fix on Jobs
            topNavQualifier + '.top-bar li {\n' +
            '    padding-bottom:0px;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .secondary-nav .-link {\n' +
            '    display:inline-block;\n' +
            '}\n' +
            '';
        addCssStyleTextToDom('ShortTopNav', css);
    }

    function addCssNarrowNavigation() {
        //Make the navigation narrower.
        if (!configOptions.checkboxes.useNarrowNavSO) {
            removeNameSpacedElementFromDom('NarrowNavigation');
            return;
        }
        let css = '' +
            topNavQualifier + '.top-bar .navigation .-link {\n' +
            '    padding: 0 8px;\n' +
            '}\n' +
            '';
        addCssStyleTextToDom('NarrowNavigation', css);
    }

    function addCssG00glen00bModifiedDarkTheme() {
        //Dark theme originally from (by g00glen00b):
        //  https://gist.github.com/g00glen00b/328bba7fdb392d3b8a7f2e6f7d468dbc
        //  With modifications.
        if (!configOptions.checkboxes.darkTopNavOnSO) {
            removeNameSpacedElementFromDom('g00glen00bModified');
            return;
        }
        let css = '' +
            'body.newheader {\n' +
            '    padding-top: 0;\n' +
            '}\n' +
            '\n' +
            topNavQualifier + '.top-bar {\n' +
            '    background-color: #333;\n' +
            '}\n' +
            '\n' +
            topNavQualifier + '.top-bar .navigation .-link,\n' +
            topNavQualifier + '.top-bar .secondary-nav .-item .-link,\n' +
            //Use the same color for reputation text as was used previously. See below.
            '.topbar-dialog .header h3,\n' +
            '.topbar-dialog .header a,\n' +
            '.topbar-dialog .header a:visited {\n' +
            '    color: #999;\n' +
            '    transition: background .3s, color .3s;\n' +
            '}\n' +
            '\n' +
            topNavQualifier + '.top-bar .navigation .-link:hover,\n' +
            topNavQualifier + '.top-bar .navigation .-link:hover:focus,\n' +
            topNavQualifier + '.top-bar .navigation .-link.topbar-icon-on,\n' +
            topNavQualifier + '.top-bar .my-profile:hover,\n' +
            topNavQualifier + '.top-bar .secondary-nav .-item .-link:hover,\n' +
            topNavQualifier + '.top-bar .secondary-nav .-item .-link.topbar-icon-on,\n' +
            topNavQualifier + '.top-bar .navigation .-item._current .-link {\n' +
            '    background-color: #555;\n' +
            '    color: #FFF;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .secondary-nav .-item:not(._current) .-link,\n' +
            topNavQualifier + '.top-bar .navigation .-item:not(._current) .-link {\n' +
            '    border-bottom: 2px solid #333;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .navigation .-item:not(._current) .-link:focus:not(:hover) {\n' +
            '    background-color: #333;\n' +
            '    color: #999;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .secondary-nav .-item:not(._current) .-link:hover,\n' +
            topNavQualifier + '.top-bar .navigation .-item:not(._current) .-link:hover,\n' +
            topNavQualifier + '.top-bar .navigation .-item:not(._current) .-link:hover:focus {\n' +
            '    border-bottom: 2px solid #555;\n' +
            '}\n' +
            '\n' +
            '.topbar-dialog .header a:hover {\n' +
            '    color: #FFF;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .-logo:hover {\n' +
            '    background-color: #555;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .indicator-badge {\n' +
            '    border: 2px solid #333;\n' +
            '    transition: border .3s,top cubic-bezier(.165, .84, .44, 1) .15s;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .secondary-nav .-link .indicator-badge:not(._regular) {\n' +
            '    transition: border .3s,top cubic-bezier(.165, .84, .44, 1) .15s;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .secondary-nav .-item .-link:hover .indicator-badge {\n' +
            '    border: 2px solid #555;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .-link.topbar-icon-on {\n' +
            '    background-color: #555;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .topbar-dialog .header,\n' +
            topNavQualifier + '.top-bar .topbar-dialog .header a:not(:hover),\n' +
            topNavQualifier + '.top-bar .topbar-dialog h3 {\n' +
            '    background-color: #555;\n' +
            '    color: #bbb;\n' +
            '}\n' +
            '.achievements-dialog .utc-clock,\n' +
            '    color: #aaa;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .topbar-dialog .header a,\n' +
            '    background-color: #555;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .indicator-badge._positive {\n' +
            '    background-color: #33A030;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .secondary-nav .-item .-link._highlighted-positive,\n' +
            topNavQualifier + '.top-bar .secondary-nav .-item .-link._highlighted-positive:hover,\n' +
            topNavQualifier + '.top-bar .secondary-nav .-item .-link._highlighted-positive.topbar-icon-on {\n' +
            '    color: #5EBA7D;\n' +
            '}\n' +
            '.f-input:hover, input.f-input[type="text"]:hover {\n' +
            '    border-color: rgba(0,149,255,1.0);\n' +
            '    box-shadow: inset 0 0 2px #d3d6da,0 0 2px rgba(0,149,255,1.0);\n' +
            '}\n' +
            '.f-input:focus, input.f-input[type="text"]:focus {\n' +
            '    border-color: #0095ff;\n' +
            '    box-shadow: inset 0 0 4px #eff0f1,0 0 5px rgba(0,149,255,1.0);\n' +
            '    outline: 0;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .secondary-nav .-item .-link.topbar-icon-on .indicator-badge {\n' +
            '    border-color: #555;\n' +
            '}\n' +
            //Colors used in prior stock top-nav (but use the same color for count as for the badge).
            topNavQualifier + '.top-bar .my-profile .-badges .badge1 + .badgecount {\n' +
            '    color: #e4e6e8\n' +
            '}\n' +
            topNavQualifier + '.top-bar .my-profile .-badges .badge2 + .badgecount {\n' +
            '    color: #e4e6e8\n' +
            '}\n' +
            topNavQualifier + '.top-bar .my-profile .-badges .badge3 + .badgecount {\n' +
            '    color: #e4e6e8\n' +
            '}\n' +
            //Reputation text: Use same color as was used in old top-nav
            topNavQualifier + '.top-bar .my-profile .-rep {\n' +
            '    color: #e4e6e8\n' +
            '}\n' +
            //Don't bold the reputation number.
            topNavQualifier + '.top-bar .my-profile .-rep {\n' +
            '    font-weight: inherit\n' +
            '}\n' +
            topNavQualifier + '.top-bar .navigation .beta-badge {\n' +
            '    color: inherit\n' +
            '}\n' +
            topNavQualifier + '.top-bar .secondary-nav .-item .-link:hover,\n' +
            topNavQualifier + '.top-bar .secondary-nav .-item .-link.topbar-icon-on {\n' +
            '    border-bottom: 2px solid #555 !important;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .secondary-nav .-item .-link.topbar-icon-on {\n' +
            '    background-color: #555 !important;\n' +
            '    color: #fff !important;\n' +
            '}\n' +
            (isMetaSO ? '' +
                topNavQualifier + '.top-bar .-logo .-img {\n' +
                '    background-position: 0px 30px;\n' +
                '    background-image: url("//i.stack.imgur.com/utBxk.png");\n' +
                '}\n' +
                '' : '') +
            '';
        addCssStyleTextToDom('g00glen00bModified', css);
    }

    /* Not used
    function addCssG00glen00bMetaLighter() {
        //Makes the top-nav lighter on Meta.
        let css = '' +
            '@-moz-document domain("meta.stackoverflow.com") {\n' +
            topNavQualifier + '    .top-bar {\n' +
            '        background-color: #DDD;\n' +
            '    }\n' +
            '}\n' +
            '';
        addCssStyleTextToDom('g00glen00bMetaLighter',css);
    }
    */

    function getLeftByReferenceEl(toRefEl, offset, fromRefEl) {
        //Get the left offset for a DOM item wrt. some other DOM item.
        //  Used to make drop down menus appear under correct positions
        let toRefRect = toRefEl.getBoundingClientRect();
        let fromRefRect = fromRefEl.getBoundingClientRect();
        let newLeft = (toRefRect.left - fromRefRect.left) + offset;
        return newLeft;
    }

    function getLeftByReferenceElToNavContainer(toRefEl, offset) {
        //Get the left offset for a DOM item wrt. the topbar container.
        return getLeftByReferenceEl(toRefEl, offset, document.querySelector(topNavQualifier + '.top-bar .-container'));
    }

    function getRightByReferenceEl(toRefEl, offset, fromRefEl) {
        //Get the right offset for a DOM item wrt. some other DOM item.
        //  Used to make drop down menus appear under correct positions
        offset = typeof offset !== 'number' ? 0 : offset;
        let toRefRect = toRefEl.getBoundingClientRect();
        let fromRefRect = fromRefEl.getBoundingClientRect();
        let newRight = (fromRefRect.right - toRefRect.right) + offset;
        return newRight;
    }

    function getRightByReferenceElToNavContainer(toRefEl, offset) {
        //Get the right offset for a DOM item wrt. the topbar container.
        return getRightByReferenceEl(toRefEl, offset, document.querySelector(topNavQualifier + '.top-bar .-container'));
    }

    var hamburgerIsConsolidated = false;
    var originalLogo;
    var originalLogoSvg;
    var originalLogoSvgParent;

    function separateHamburger() {
        //Separate the site switcher if it's already been consolidated.
        if (!hamburgerIsConsolidated) {
            return;
        }
        let hamburger = listItems.hamburger.link;
        hamburger.querySelector('.' + nameSpace + 'drop-down-triangle').remove();
        originalLogo.style.display = '';
        if (isSO) {
            hamburger.querySelector('span.-img._glyph').remove();
        } else {
            originalLogoSvgParent.appendChild(originalLogoSvg);
            originalLogoSvg.classList.remove('mak-top-nav-choices-dropdown-marker');
        }
        hamburger.querySelector('svg').style.display = '';
        hamburger.classList.remove('-logo');
        //Put the hamburger back under it's -list.
        listItems.hamburger.container.appendChild(listItems.hamburger.link);
        removeNameSpacedElementFromDom('consolidateHamburger');
        hamburgerIsConsolidated = false;
        let main = header.querySelector('.-main');
        let logo = main.querySelector('.-logo');
        main.insertBefore(logo, main.firstChild);
    }

    function consolidateHamburger() {
        //Consolidate the site switcher and the site logo.
        if (hamburgerIsConsolidated || !configOptions.checkboxes.consolidateHamburger) {
            return;
        }
        let headerMain = header.querySelector('.-main');
        let addCss = '';
        let hamburger = listItems.hamburger.link;
        if (hamburger) {
            //Move the hamburger to the left & merge with site logo.
            let origLogo;
            if (!originalLogo) {
                originalLogo = origLogo = headerMain.querySelector('.-logo');
            } else {
                origLogo = originalLogo;
            }
            let origLogoStyle = window.getComputedStyle(origLogo);
            let origLogoStyleWidth = parseInt(origLogoStyle.getPropertyValue('width'));
            headerMain.insertBefore(hamburger, headerMain.firstChild);
            hamburger.classList.add('-logo');
            hamburger.querySelector('svg').style.display = 'none';
            if (isSO) {
                hamburger.insertAdjacentHTML('beforeend', '<span class="-img _glyph"></span>');
            } else {
                //Other sites use embedded SVG for the logo.
                let origLogoSvg = origLogo.querySelector('svg');
                if (!originalLogoSvg) {
                    originalLogoSvg = origLogoSvg;
                }
                if (!originalLogoSvgParent) {
                    originalLogoSvgParent = origLogoSvg.parentNode;
                }
                hamburger.appendChild(origLogoSvg);
                origLogoSvg.classList.add('mak-top-nav-choices-dropdown-marker');
            }
            hamburger.insertAdjacentHTML('beforeend', '<span class="' + nameSpace + 'drop-down-triangle"></span>');
            origLogo.style.display = 'none';
            let dropDownMarkerWidth = 11;
            let dropDownMarkerSpacerWidth = 6;
            //Account for extra space in http://meta.stackoverflow.com/ logo:
            if (isMetaSO) {
                dropDownMarkerSpacerWidth -= 3;
            }
            let dropDownMarkerWithSpacerWidth = dropDownMarkerWidth + dropDownMarkerSpacerWidth;
            let totalHamLogoWidthWithDropdown = origLogoStyleWidth + dropDownMarkerWithSpacerWidth;
            addCss += '' +
                topNavQualifier + '.top-bar .siteSwitcher-dialog {\n' +
                '    left:' + getLeftByReferenceElToNavContainer(hamburger, -1) + 'px;\n' +
                '}\n' +
                // Drop-down triangle
                topNavQualifier + '.top-bar .-logo._glyph {\n' +
                '   padding-right:0px;\n' +
                '   width:' + totalHamLogoWidthWithDropdown + 'px;\n' + //This should be image width + SVG width + spacer.
                '}\n' +
                topNavQualifier + '.top-bar.js-top-bar .' + nameSpace + 'drop-down-triangle,\n' +
                topNavQualifier + '.top-bar .' + nameSpace + 'drop-down-triangle {\n' +
                '    background-position: -119px -30px;\n' +
                '    background-color: transparent;\n' +
                '    background-repeat: no-repeat;\n' +
                '    background-image: url("https://cdn.sstatic.net/img/share-sprite-new.svg?v=78be252218f3");\n' +
                '    display: inline-block;\n' +
                '    width: ' + dropDownMarkerWidth + 'px;\n' +
                '    height: 13px;\n' +
                '    margin-left: 6px;\n' +
                '    vertical-align: top;\n' +
                '}\n' +
                '';
            addCss += '' +
                topNavQualifier + '.top-bar .-logo {\n' +
                '    padding-right: 0px;\n' +
                '}\n' +
                '';
        }
        addCssStyleTextToDom('consolidateHamburger', addCss);
        hamburgerIsConsolidated = true;
    }

    function addHelpButton() {
        //Add the help button if it doesn't already exist.
        let secondaryNavList = originalNav.querySelector('.-list');
        let helpButton = header.querySelector('.js-help-button');
        if (typeof originalHelpButtonState === 'undefined') {
            originalHelpButtonState = !!helpButton;
        }
        if (helpButton) {
            if (!configOptions.checkboxes.addHelp && !originalHelpButtonState) {
                helpButton.parentNode.remove();
                return;
            }
            return;
        } // else
        if (!configOptions.checkboxes.addHelp) {
            return;
        } // else
        //Create the help button
        let helpButtonHtml = '' +
            '<li class="-item"><a href="#" class="-link js-help-button" title="Help Center and other resources">' +
            '<svg viewBox="0 0 18 18" width="18" height="18" role="icon" class="svg-icon"><path fill-rule="evenodd" d="M9 0a9 9 0 1 0 .001 18.001A9 9 0 0 0 9 0zm.812 13.126c-.02.716-.55 1.157-1.238 1.137-.659-.02-1.177-.49-1.157-1.209.02-.715.566-1.17 1.225-1.15.691.021 1.194.507 1.17 1.222zm1.956-5.114c-.168.237-.546.542-1.02.912l-.527.361c-.257.197-.417.43-.502.695-.044.141-.076.507-.084.752-.004.048-.032.156-.181.156H7.883c-.165 0-.185-.096-.18-.144.023-.667.12-1.218.397-1.66.374-.594 1.426-1.221 1.426-1.221.161-.12.286-.25.382-.39.177-.24.321-.51.321-.8 0-.333-.08-.65-.293-.915-.249-.31-.518-.458-1.036-.458-.51 0-.808.257-1.021.594-.213.338-.177.735-.177 1.097H5.746c0-1.366.357-2.238 1.112-2.752.51-.35 1.162-.502 1.921-.502.996 0 1.788.184 2.487.715.647.49.988 1.181.988 2.113 0 .575-.2 1.057-.486 1.447z"></path></svg>' +
            '</a></li>' +
            '';
        secondaryNavList.insertAdjacentHTML('beforeend', helpButtonHtml);
        helpButton = header.querySelector('.js-help-button');
        listItems.help = new KnownItem(helpButton.parentNode, helpButton, 'help-dialog');
    }

    function createSecondaryNavContainers() {
        //Create the additional secondary-nav containers for left and center.
        let headerMain = header.querySelector('.-main');
        let logo = headerMain.querySelector('.-logo');
        if (!secondaryNavAfterLogo) {
            logo.insertAdjacentHTML('afterend', '<nav class="secondary-nav ' + nameSpace + 'after-logo"><ol class="-list"></ol></nav>');
            secondaryNavAfterLogo = headerMain.querySelector('.' + nameSpace + 'after-logo');
        }
        if (!secondaryNavBeforeSearch) {
            headerMain.insertAdjacentHTML('beforeend', '<nav class="secondary-nav ' + nameSpace + 'before-search"><ol class="-list"></ol></nav>');
            secondaryNavBeforeSearch = headerMain.querySelector('.' + nameSpace + 'before-search');
        }
        let addCss = '' +
            topNavQualifier + '.top-bar .secondary-nav.' + nameSpace + 'after-logo {\n' +
            '    margin-right: 15px;\n' +
            '    margin-left: 10px;\n' +
            '}\n' +
            topNavQualifier + '.top-bar .secondary-nav.' + nameSpace + 'before-search {\n' +
            '    margin-right: ' + configOptions.numbers['centerMarginRight' + (isSO ? '' : 'Non') + 'SO'] + 'px;\n' +
            '    margin-left: ' + configOptions.numbers['centerMarginLeft' + (isSO ? '' : 'Non') + 'SO'] + 'px;\n' +
            '}\n' +
            '';
        addCssStyleTextToDom('additionalSecondaryNavs', addCss);
    }

    function moveItems() {
        //Move all the drop-down menu buttons and their drop downs.
        moveOrder.forEach(function(itemName) {
            if (itemName === 'hamburger' && hamburgerIsConsolidated) {
                removeNameSpacedElementFromDom('move-' + listItems[itemName].dialogClass);
                return;
            }
            if (listItems[itemName] && configOptions.locations[itemName]) {
                moveItem(listItems[itemName], configOptions.locations[itemName]);
            } else {
                //This would just report items which the user doesn't have access to (e.g. reviews).
                //console.log('Unable to move: itemName:', itemName, '::  listItems[itemName]:', listItems[itemName], '::  configOptions.locations[itemName]:', configOptions.locations[itemName]);
            }
        });
        listItems.unknown.forEach(function(item) {
            if (item) {
                moveItem(item, configOptions.locations.unknown);
            } else {
                console.log('Unable to move: item:', item, '::  configOptions.locations.unknown:', configOptions.locations.unknown);
            }
        });
        if (!secondaryNavBeforeSearch.querySelector('.-item')) {
            secondaryNavBeforeSearch.style.display = 'none';
        } else {
            secondaryNavBeforeSearch.style.display = '';
        }
    }

    function moveItem(item, which) {
        //Move a drop-down menu buttons and it's drop downs.
        function insertDialogCSS() {
            let addCss = topNavQualifier + '.top-bar .' + item.dialogClass + ' {\n';
            if (which < 10) {
                addCss += '' +
                    '    left:' + getLeftByReferenceElToNavContainer(item.container, -1) + 'px;\n' +
                    '    top: ' + topNavHeight + 'px !important;\n' +
                    '';
            }
            addCss += '}\n';
            addCssStyleTextToDom('move-' + item.dialogClass, addCss);
            let dialog = header.querySelector('.' + item.dialogClass);
            if (dialog) {
                dialog.style.right = getRightByReferenceElToNavContainer(item.container, -1) + 'px';
                //The site switcher can get confused.
                dialog.style.top = topNavHeight + 'px';
            }
        }
        if (!secondaryNavAfterLogo || !secondaryNavBeforeSearch) {
            createSecondaryNavContainers(header);
        }
        let addListContainer;
        if (which === 1) {
            addListContainer = secondaryNavAfterLogo;
        } else if (which === 5) {
            addListContainer = secondaryNavBeforeSearch;
        } else if (which === 10) {
            addListContainer = originalNav;
        } else {
            return;
        }
        let addList = addListContainer.querySelector('.-list');
        if (item && addList) {
            addList.appendChild(item.container);
            if (item.dialogClass) {
                //Set where the dialog will show. Do this after everything is adjusted.
                setTimeout(insertDialogCSS, 100);
            }
        }
    }

    function setJobsText() {
        //Set the text for "Developer Jobs"
        var jobs = document.getElementById('nav-jobs');
        if (jobs) {
            if (!originalJobsText) {
                originalJobsText = jobs.textContent;
            }
            if (configOptions.checkboxes.useJobsForJobsText) {
                jobs.textContent = 'Jobs';
            } else {
                jobs.textContent = originalJobsText;
            }
        }
    }

    function setScrollingNav() {
        //Make the top-nav sticky. Use one setting across all new-nav sites.
        var isSticky = configOptions.checkboxes.sticky;
        var height = topNavHeight;
        let addCss = '';
        //Change scrolling:
        if (!isSticky) {
            header.classList.remove('_fixed');
            addCss += '' +
                '.review-bar-container .review-bar {\n' +
                '    top: 0px !important;\n' +
                '}\n' +
                '';
        } else {
            header.classList.add('_fixed');
            addCss += '' +
                '.review-bar-container .review-bar {\n' +
                '    top: ' + height + 'px !important;\n' +
                '}\n' +
                topNavQualifier + '.top-bar._fixed {\n' +
                '    position: fixed;\n' +
                '    min-width: auto;\n' +
                '}\n' +
                '';
        }
        addCssStyleTextToDom('stickyNonStickyNav', addCss);
    }

    function whenHeaderExists() {
        //Changes that need to be made after the DOM loads.
        function getDialogFromLinkClass(link) {
            return link.className.replace(/^.*js-([^-]*)-button\b.*$/, '$1-dialog');
        }
        header = document.querySelector('.top-bar');
        currentUserHref = document.querySelector('.topbar .profile-me,.so-header .my-profile,.top-bar .my-profile').href;
        currentUserId = currentUserHref.replace(/^https?:\/\/[^\/]*\/users\/(\d+)\/.*$/, '$1');
        if (!header) {
            //It's not a new header
            return;
        } //else
        //It's a new header
        //Get the items we know about
        header.classList.add(topNavQualifier.replace(/^\./, ''));
        originalNav = header.querySelector('.secondary-nav');
        let items = [].slice.call(header.querySelectorAll('.-item'));
        items.forEach(function(item) {
            let link = item.querySelector('a.-link');
            if (link) {
                if (moveOrder.some(function(testItem) {
                    if (link.classList.contains('js-' + testItem + '-button')) {
                        listItems[testItem] = new KnownItem(item, link, getDialogFromLinkClass(link));
                        return true;
                    } //else
                })) {
                    return;
                }
                if (link.classList.contains('js-site-switcher-button')) {
                    listItems.hamburger = new KnownItem(item, link, 'siteSwitcher-dialog');
                    return;
                } //else
                if (['questions', 'jobs', 'tags', 'users'].some(function(testItem) {
                    if (link.id === 'nav-' + testItem) {
                        listItems[testItem] = new KnownItem(item, link);
                        return true;
                    } //else
                    return false;
                })) {
                    return;
                }
            }
            //XXX testing: This can be used to determine the class to match for unknown drop-downs (e.g. moderator tools).
            //console.log('item.className:', item.className, '::  link.className:', link.className);
            //console.log('Unknown item:', item, '::  link:', link);
            //Using getDialogFromLinkClass here is an attempt to have this work on whatever menu happens to exist
            //  for moderators.
            listItems.unknown.push(new KnownItem(item, link, getDialogFromLinkClass(link)));
        });
        if (listItems.unknown.length > 0) {
            //console.log('listItems.unknown:', listItems.unknown);
        }
        let newNavEl = document.querySelector('.new-topbar');
        //Stack Overflow header
        if (isSO && newNavEl && header) {
            setJobsText();
        }
        if (header) {
            consolidateHamburger();
            addHelpButton();
            moveItems();
            setScrollingNav();
        }
    }

    function addCssStyleTextToDom(id, cssText) {
        //Add CSS as new element to the end of the documentElement.
        // Can be used prior to the page HTML loading. If added after the existence of <body>
        // it gives it priority over duplicate rules normally included in the HTML.
        //Create the new element
        let newStyle = document.createElement('style');
        newStyle.setAttribute('type', 'text/css');
        newStyle.id = nameSpace + id;
        newStyle.textContent = '\n' + cssText;
        //Make sure there this is not double-adding the style
        removeNameSpacedElementFromDom(id);
        document.documentElement.appendChild(newStyle);
    }

    function removeNameSpacedElementFromDom(id) {
        //Remove an element from the DOM by id, which was added with our nameSpace.
        let oldStyle = document.getElementById(nameSpace + id);
        if (oldStyle) {
            oldStyle.parentNode.removeChild(oldStyle);
        }
    }

    function addCssPreDom() {
        //Add CSS changes that can be made prior to the DOM being loaded.
        //  This can not include any CSS which must be changed or loaded/not loaded
        //  based on the DOM. This is only CSS which can be loaded on every page.
        //This is currently assumed to include any CSS for the new top-nav as long as the
        //  CSS is appropriately qualified.
        addNoTopOrange();
        addShortTopNav(topNavHeight);
        addCssNarrowNavigation();
        addCssG00glen00bModifiedDarkTheme();
    }


    var observerForContainer;

    function doTasksRequiringHeader(callback) {
        //Observe document.body for elements. Run the callback when the container (first after the top-bar) exists.
        //  This results in the callback running immediately after the top-bar exists.
        header = document.querySelector('.top-bar');
        if (header === null) {
            if (typeof observerForContainer !== 'object' || observerForContainer === null) {
                observerForContainer = new MutationObserver(function() {
                    var nodes = document.body.childNodes;
                    if (nodes && nodes.length > 0) {
                        for (let index = 0; index < nodes.length; index++) {
                            let node = nodes[index];
                            if (node.nodeName === 'DIV' && node.classList.contains('container')) {
                                observerForContainer.disconnect();
                                callback();
                            }
                        }
                    }
                });
                observerForContainer.observe(document.body, {
                    childList: true
                });
            }
        } else {
            callback();
        }
    }

    var observerForBody;

    function doTasksRequiringBody() {
        //Observe document.documentElement for the <body>. When it exists, run the tasks which
        //  require it.
        if (document.body === null) {
            if (typeof observerForBody !== 'object' || observerForBody === null) {
                observerForBody = new MutationObserver(function() {
                    if (document.body !== null) {
                        observerForBody.disconnect();
                        whenBodyExists();
                    }
                });
                observerForBody.observe(document.documentElement, {
                    childList: true
                });
            }
        } else {
            whenBodyExists();
        }

        function whenBodyExists() {
            addCssPreDom();
            doTasksRequiringHeader(whenHeaderExists);
        }
    }

    function afterLoaded() {
        //Tasks to be run after the document is loaded.
        if (window.location.pathname === '/users/preferences/' + currentUserId) {
            constructPreferences();
        }
    }

    function constructPreferences() {
        //Construct the preferences on the user's preferences page.

        function createCheckboxOptionHtml(optionKey, checkboxItem) {
            //Make the HTML for a CheckboxOption.
            return '' +
                '<p class="' + nameSpace + 'OptionSubItem">' +
                '    <label title="' + checkboxItem.tooltip + '">' +
                '        <input type="checkbox" name="' + nameSpace + 'optionCheckbox-' + optionKey + '" ' + (configOptions.checkboxes[optionKey] ? ' checked' : '') + '>' + checkboxItem.text +
                '    </label>' +
                '</p>' +
                '';
        }

        function createNumberOptionHtml(optionKey, numberItem) {
            //Make the HTML for a NumberOption.
            return '' +
                '<p class="' + nameSpace + 'OptionSubItem">' +
                '    <div class="' + nameSpace + 'OptionsNumberContainer" title="' + numberItem.tooltip +'">' +
                         numberItem.textPre +
                '        <input type="number" min="' + numberItem.min + '" max="' + numberItem.max + '" name="' + nameSpace + 'optionNumber-' + optionKey + '" style="' + numberItem.style + '"/>' +
                         numberItem.textPost +
                '    </div>' +
                '</p>' +
                '';
        }

        function createNumberMinimalOptionHtml(optionKey, numberItem) {
            //Make minimal HTML for a NumberOption.
            return '' +
                '    <span class="' + nameSpace + 'OptionsNumberContainer" title="' + numberItem.tooltip +'">' +
                         numberItem.textPre +
                '        <input type="number" min="' + numberItem.min + '" max="' + numberItem.max + '" name="' + nameSpace + 'optionNumber-' + optionKey + '" style="' + numberItem.style + '"/>' +
                         numberItem.textPost +
                '    </span>' +
                '';
        }

        /* Not used
        function createRadioOptionHtml(optionKey, radioItem, defaultValue) {
            //Make the HTML for a RadioOption.
            var isLocation = typeof defaultValue !== 'undefined';
            defaultValue = isLocation ? defaultValue : configOptions.radios[optionKey];
            var text ='' +
                '<p class="' + nameSpace + 'OptionSubItem">' +
                '<span class="' + nameSpace + 'radiosDescription">' + radioItem.text + '</span>' + 
                '    <span class="' + nameSpace + 'Options' + (isLocation ? 'Location' : 'Radio') + 'Container" title="' + radioItem.tooltip +'">' +
                '';
            radioItem.radios.forEach(function(radio) {
                text += '' +
                    '    <label title="' + radio.tooltip + '">' +
                    '        <input type="radio" name="' + nameSpace + 'option' + (isLocation ? 'Location' : 'Radio') + '-' + optionKey + '" value="' + radio.defaultValue + '" ' + (radio.defaultValue == defaultValue ? ' checked' : '') + '>' + radio.text +
                    '    </label>' +
                '';
            });
            text += '' +
                '    </span>' +
                '</p>' +
                '';
            return text;
        }
        */

        function createLocationOptionHtml(optionKey, radioItem, defaultValue) {
            //Make the HTML for a LocationOption.
            var isLocation = typeof defaultValue !== 'undefined';
            defaultValue = isLocation ? defaultValue : configOptions.radios[optionKey];
            var text = '' +
                '<tr class="' + nameSpace + 'OptionSubItem">' +
                '<td class="' + nameSpace + 'radiosDescription">' + radioItem.text + '</td>' +
                '    <td class="' + nameSpace + 'OptionsLocationContainer" title="' + radioItem.tooltip + '">' +
                '';
            radioItem.radios.forEach(function(radio) {
                text += '' +
                    '    <label title="' + radio.tooltip + '">' +
                    '        <input type="radio" name="' + nameSpace + 'option' + (isLocation ? 'Location' : 'Radio') + '-' + optionKey + '" value="' + radio.defaultValue + '" ' + (radio.defaultValue == defaultValue ? ' checked' : '') + '>' + radio.text +
                    '    </label>' +
                    '';
            });
            text += '' +
                '    </td>' +
                '</tr>' +
                '';
            return text;
        }

        var basePref = '' +
            '<div class="inner-container inner-container-flex ' + nameSpace + 'pref-container" id="' + nameSpace + 'preferences">' +
            '    <div class="title-box">' +
            '        <div class="title">' +
            '            Top-Navigation Choices' +
            '            <div>(user script)</div>' +
            '            <div><a href="https://stackapps.com/questions/7603/top-navigation-choices" target="_blank">on StackAps</a></div>' +
            '            <div><a href="https://github.com/makyen/StackExchange-userscripts/tree/master/Top-Nav-Choices" target="_blank">on GitHub</a></div>' +
            '            <div><a href="https://github.com/makyen/StackExchange-userscripts/issues/new" target="_blank">report a bug</a></div>' +
            '        </div>' +
            '    </div>' +
            '    <div class="content">' +
            '    </div>' +
            '</div>' +
            '';
        var prefContainer = document.getElementById('email-container');
        prefContainer.insertAdjacentHTML('beforeend', basePref);
        var prefContent = prefContainer.querySelector('.' + nameSpace + 'pref-container .content');
        //XXX This needs some better formatting for the HTML
        //Create the checkboxes
        Object.keys(knownOptions.checkboxes).forEach(function(key) {
            prefContent.insertAdjacentHTML('beforeend', createCheckboxOptionHtml(key, knownOptions.checkboxes[key]));
            knownOptions.checkboxes[key].input = prefContent.querySelector('input[name="' + nameSpace + 'optionCheckbox-' + key + '"]');
        });
        //Create the top nav height number selection.
        ['topNavHeight'].forEach(function(key) {
            prefContent.insertAdjacentHTML('beforeend', createNumberOptionHtml(key, knownOptions.numbers[key]));
        });
        //Create the drop-down navigation button location selections.
        prefContent.insertAdjacentHTML('beforeend', '<div class="' + nameSpace + 'locations-container"><h3>Drop-down navigation button locations</h3><table><tbody></tbody></table></div>');
        var locationDiv = prefContent.querySelector('.' + nameSpace + 'locations-container tbody');
        Object.keys(knownOptions.locations).forEach(function(key) {
            locationDiv.insertAdjacentHTML('beforeend', createLocationOptionHtml(key, knownOptions.locations[key], configOptions.locations[key]));
            knownOptions.locations[key].inputs = prefContent.querySelectorAll('input[name="' + nameSpace + 'optionLocation-' + key + '"]');
        });
        //Create the center margin selections.
        var onSOmargins = prefContent.appendChild(document.createElement('p'));
        ['centerMarginLeftSO', 'centerMarginRightSO'].forEach(function(key) {
            onSOmargins.insertAdjacentHTML('beforeend', createNumberMinimalOptionHtml(key, knownOptions.numbers[key]));
        });
        var nonSOmargins = prefContent.appendChild(document.createElement('p'));
        ['centerMarginLeftNonSO', 'centerMarginRightNonSO'].forEach(function(key) {
            nonSOmargins.insertAdjacentHTML('beforeend', createNumberMinimalOptionHtml(key, knownOptions.numbers[key]));
        });
        //Fill the NumberOptions with their current values.
        Object.keys(knownOptions.numbers).forEach(function(key) {
            knownOptions.numbers[key].input = prefContent.querySelector('input[name="' + nameSpace + 'optionNumber-' + key + '"]');
            knownOptions.numbers[key].input.value = configOptions.numbers[key];
        });
        prefContent.addEventListener('input', debounceInput, true);
        prefContent.addEventListener('keyup', debounceInput, true);
        prefContent.addEventListener('change', debounceInput, true);
        prefContent.addEventListener('click', debounceInput, true);
        var nameSpaceClass = '.' + nameSpace;
        let addCss = '' +
            nameSpaceClass + 'locations-container {\n' +
            '    width: 100%;\n' +
            '    margin-bottom: 10px;\n' +
            '}\n' +
            nameSpaceClass + 'locations-container label {\n' +
            '    margin-right: 10px;\n' +
            '    margin-left: 10px;\n' +
            '}\n' +
            nameSpaceClass + 'locations-container ' + nameSpaceClass + 'OptionSubItem {\n' +
            '    margin-right: auto;\n' +
            '    margin-left: auto;\n' +
            '}\n' +
            nameSpaceClass + 'locations-container h3 {\n' +
            '    font-weight: bold !important;\n' +
            '}\n' +
            nameSpaceClass + 'locations-container ' + nameSpaceClass + 'radiosDescription {\n' +
            '    margin: 0 auto;\n' +
            '}\n' +
            nameSpaceClass + 'OptionSubItem input[type="checkbox"] {\n' +
            '    margin-right: 7px;\n' +
            '}\n' +
            nameSpaceClass + 'OptionSubItem input[type="radio"] {\n' +
            '    margin-right: 5px;\n' +
            '}\n' +
            nameSpaceClass + 'pref-container .title div {\n' +
            '    font-size: 80%;\n' +
            '}\n' +
            '';
        addCssStyleTextToDom('preferenceStyles', addCss);
    }

    var inputTimeout = 0;

    function debounceInput(e) {
        //Don't immediately update the top-nav if the user is still providing input.
        e.stopPropagation();
        clearTimeout(inputTimeout);
        inputTimeout = setTimeout(readAndStorePreferencesFromPage, 100);
    }

    function readAndStorePreferencesFromPage() {
        //Get and save the values from the on-page preferences. Apply them to the current top-nav.
        Object.keys(knownOptions.checkboxes).forEach(function(key) {
            configOptions.checkboxes[key] = knownOptions.checkboxes[key].input.checked;
        });
        Object.keys(knownOptions.locations).forEach(function(key) {
            var inputs = knownOptions.locations[key].inputs;
            for (let index = 0; index < inputs.length; index++) {
                if (inputs[index].checked) {
                    configOptions.locations[key] = +inputs[index].value;
                    break;
                }
            }
        });
        Object.keys(knownOptions.numbers).forEach(function(key) {
            configOptions.numbers[key] = knownOptions.numbers[key].input.value;
        });
        storeConfigOptions();
        updateTopNav();
    }

    function updateTopNav() {
        //Update the Top-Nav settings.
        if (!header) {
            //This is not a new top-nav site.
            return;
        }
        setTopHeightByConfig();
        if (hamburgerIsConsolidated && !configOptions.checkboxes.consolidateHamburger) {
            separateHamburger();
        }
        if (!hamburgerIsConsolidated && configOptions.checkboxes.consolidateHamburger) {
            consolidateHamburger();
        }
        moveItems();
        addCssG00glen00bModifiedDarkTheme();
        setScrollingNav();
        addHelpButton();
        setJobsText();
        addNoTopOrange();
        createSecondaryNavContainers(); //Just changes CSS
        addShortTopNav(topNavHeight);
        addCssNarrowNavigation();
    }


    function storeConfigOptions(options) {
        //Save the Configuration options.
        options = options ? options : configOptions;
        var asJson = JSON.stringify(options);
        GM_setValue('configOptions', asJson);
    }

    /* Not used
    function setCheckboxConfigSubOption(checkboxKey, value, dontStore) {
        //Set some options that in subkeys in the configOptions Object.
        //Avoid computed property name for IE compatibility
        var options = {
            checkboxes: {}
        };
        options.checkboxes[checkboxKey] = value;
        setSomeConfigSubOptions(options, dontStore);
    }
    */

    /* Not used
    function setNumberConfigSubOption(numberKey, value, dontStore) {
        //Set some options that in subkeys in the configOptions Object.
        //Avoid computed property name for IE compatibility
        var options = {
            numbers: {}
        };
        options.numbers[numberKey] = value;
        setSomeConfigSubOptions(options, dontStore);
    }
    */

    /* Not used
    function setSomeConfigSubOptions(options, dontStore) {
        //Set some options that in subkeys in the configOptions Object.
        Object.keys(options).forEach(function(key) {
            Object.assign(configOptions[key], options[key]);
        });
        if (!dontStore) {
            storeConfigOptions();
        }
    }
    */

    /* Not used
    function setSomeConfigOptions(options, dontStore) {
        //Set some options that are directly on the configOptions Object.
        Object.assign(configOptions, options);
        if (!dontStore) {
            storeConfigOptions();
        }
    }
    */

    function getDefaultConfigOptions() {
        //Get the default option values from the knownOptions Object.
        return Object.keys(knownOptions).reduce(function(def, key) {
            if (typeof knownOptions[key].defaultValue === 'undefined') {
                //No defaultValue, so assume it's a subkey
                def[key] = Object.keys(knownOptions[key]).reduce(function(sum, prop) {
                    sum[prop] = knownOptions[key][prop].defaultValue;
                    return sum;
                }, {});
            } else {
                def[key] = knownOptions[key].defaultValue;
            }
            return def;
        }, {});
    }

    function mergeDefaultConfigOptions(opt) {
        //Only fill in defaults where no value exists.
        var def = getDefaultConfigOptions();
        Object.keys(def).forEach(function(key) {
            if (typeof def[key].defaultValue === 'undefined') {
                //The key does not contain a default, so is assumed to be a subkey.
                if (typeof opt[key] !== 'object') {
                    opt[key] = {};
                }
                Object.keys(knownOptions[key]).forEach(function(prop) {
                    if (typeof opt[key][prop] === 'undefined') {
                        opt[key][prop] = knownOptions[key][prop].defaultValue;
                    }
                });
            } else {
                if (typeof opt[key] === 'undefined') {
                    opt[key] = knownOptions[key].defaultValue;
                }
            }
        }, {});
        return opt;
    }

    function getConfigOptions() {
        var jsonOptions;
        jsonOptions = GM_getValue('configOptions');
        try {
            return mergeDefaultConfigOptions(JSON.parse(jsonOptions));
        } catch (e) {
            //JSON.parse failed, storage is corrupt or this is the first time we've used it.
            var defaults = getDefaultConfigOptions();
            console.log('getConfigOptions: using defaults:', defaults);
            storeConfigOptions(defaults);
            return defaults;
        }
    }

    var configOptionsChangeListener;

    function trackConfigOptionsChangesIfPossible() {
        //If the user script manager in which this is running allows listening for changes to
        //  user script storage, then listen for changes to the shortcut key (e.g. in another tab).
        if (!canListenGMStorage || //Not available: Greasemonkey
            configOptionsChangeListener //Already added, don't add again
        ) {
            return;
        }
        configOptionsChangeListener = GM_addValueChangeListener('configOptions', function(name, oldValue, newValue, remote) {
            //Listen for external changes.
            //Note: External changes only partially affect the GUIs, as already existing GUIs will have been configured based on
            //  some settings as they were at the time the GUI was created. If we really wanted to have external changes fully
            //  supported, then all the GUIs would need to be destroyed and recreated (or changed in-place).
            if (remote) {
                configOptions = JSON.parse(newValue);
                setTopHeightByConfig();
                //Update the top nav to any changes which were made in another tab.
                updateTopNav();
                //No attempt is made to update the preferences in the preferences page.
            }
        });
    }
    trackConfigOptionsChangesIfPossible();

})();