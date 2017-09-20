# Stack Exchange Top Nav Choices (&#8202;[install](https://github.com/makyen/StackExchange-userscripts/raw/master/Top-Nav-Choices/Stack_Exchange_Top_Nav_Choices.user.js)&#8202;)

*Top Nav Choices* changes the new Stack Exchange/Stack Overflow top navigation based on the preferences you set. The preferences are accessed on your normal Stack Exchange preferences page<sup>1</sup>.

Default changed top navigation on Stack Overflow with dark theme, and inbox and achievements on the left and the help button added (all changes are options)  
[![Default changed top navigation on Stack Overflow][1]][1]

Stack Overflow with stock light theme and different drop-down button placement:  
[![Stack Overflow light theme different drop-down placement][2]][2]

Default top navigation on Meta Stack Exchange:  
[![Default top navigation Meta Stack Exchange][5]][5]


# Available options:

* Merge the Site Switcher with the site logo (on the left).
* Dark Top-Navigation theme on Stack Overflow and Meta Stack Overflow.
* Sticky Top-Navigation (all sites with new navigation).
* Add the help button if it's not already displayed.
* On Stack Overflow, show "Jobs" instead of "Developer Jobs".
* Apply the selected height to sites other than Stack Overflow/Meta Stack Overflow.
* Show the orange line along the top of the Top-Navigation on Stack Overflow/Meta Stack Overflow.
* Narrow the space taken by "Questions", etc. on Stack Overflow/Meta Stack Overflow. 
* Adjust the top navigation height
* Add the Help button, if it doesn't already exist.
* Change the position to left, right, or center for the drop-down menu buttons:
  * Inbox
  * Achievements
  * Reviews
  * Help
  * Site Switcher
  * Other (moderator tools?)
* Adjust the spacing used for the "center" drop-down position.

## Preferences example
[![Preferences example][4]][4]

## Additional features / bugs
Please, feel free to [open an issue](https://github.com/makyen/StackExchange-userscripts/issues/new) if you desire an additional feature. You should, of course, also do so if you encounter a bug.

## Moderator tools
The "other" category should pick up the moderator tools. I'm not a moderator on any Stack Exchange site, so I'm unable to test it. I'm happy to update the script to have a explicit moderator tools drop-down button location selection. However, to do so I need either access to the top-nav HTML, or, at a minimum, the js-button `class` which is applied to the button (which should look like `js-[something]-button`) and the class applied to the drop-down (which should look something like `[same something]-dialog`). If they have that format, then I need to know the "something". If they don't have that format, I'm going to need the details. I also need to know if it's more than one drop-down button (appears to be so from screenshots). If the moderator tools are more than one drop down, I'm going to need the "something" for both.

## Compatibility notes
*Top Nav Choices* has been tested on Chrome (Tampermonkey) and Firefox (Greasemonkey). It should be compatible with other browsers and user script managers.

-------
 <sup>1. The URL for your preferences page is `https://[Stack Exchange site]/users/preferences/[your user #]`). You can get there by going to your profile page and selecting: <kbd>Edit Profile & Settings</kbd> (tab) ➞ <kbd>Preferences</kbd> (sidebar under "SITE SETTINGS"). The added preferences will show up on all stack exchange sites (except Area 51, which doesn't have preferences).</sup>




  [1]: https://github.com/makyen/StackExchange-userscripts/raw/master/Top-Nav-Choices/README-assets/SO-TNC-SO-default-top-nav.png
  [2]: https://github.com/makyen/StackExchange-userscripts/raw/master/Top-Nav-Choices/README-assets/SO-TNC-SO-light-theme-achievments-and-inbox-center-top-nav.png
  [3]: https://github.com/makyen/StackExchange-userscripts/raw/master/Top-Nav-Choices/README-assets/SO-TNC-preferences-default.png
  [4]: https://github.com/makyen/StackExchange-userscripts/raw/master/Top-Nav-Choices/README-assets/SO-TNC-preferences.gif
  [5]: https://github.com/makyen/StackExchange-userscripts/raw/master/Top-Nav-Choices/README-assets/SO-TNC-MSE-default-top-nav.png
