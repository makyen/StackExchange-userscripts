#Roomba Forecaster ([install](https://github.com/makyen/StackExchange-userscripts/raw/master/Roomba-Forecaster/RoombaForecaster.user.js))

Roomba Forecaster shows the question's status with respect to being deleted by Roomba.

The script adds a "roomba" status line under "viewed"/"active" in the top-right of
question pages which shows if the question will be deleted
by [Roomba](http://stackoverflow.com/help/roomba), and how long until
the question is deleted. Why Roomba won't delete the question is, by default, displayed in a tooltip.  You can click on the "roomba" status line to open an options dialog to change display settings.
[![Roomba Forecaster location on the page](https://github.com/makyen/StackExchange-userscripts/raw/master/Roomba-Forecaster/README-assets/location-on-page-with-red-circle-660px.png)](https://github.com/makyen/StackExchange-userscripts/raw/master/Roomba-Forecaster/README-assets/location-on-page-with-red-circle.png)

###Additional information in tooltip (default)
The reasons the question does not qualify for the three different Roomba tasks is included in a table.  The table is, by default displayed in a tooltip when the mouse hovers over the "roomba" status line:    
![tooltip](https://github.com/makyen/StackExchange-userscripts/raw/master/Roomba-Forecaster/README-assets/tooltip.png)

Alternately, the table can be always visible by selecting the appropriate display option.

###Show if your down-vote(s) can qualify the question to be Roomb'ed (default)
In addition, the default is to display if you down-voting on the question and/or answer(s) will qualify the question to be Roomba'ed.

question | answer(s)
:-------------------------:|:-------------------------:  
![downvote question will roomba](https://github.com/makyen/StackExchange-userscripts/raw/master/Roomba-Forecaster/README-assets/downvote-question-will-roomba.png) | ![downvote answer will roomba](https://github.com/makyen/StackExchange-userscripts/raw/master/Roomba-Forecaster/README-assets/downvote-answer-will-roomba.png)


###Number of days to deletion
If the question will be deleted by Roomba, then the number of days until it is deleted is displayed. 

One Roomba task runs daily | Two Roomba tasks run weekly<sup>1</sup>   
:-------------------------:|:-------------------------:
![daily roomba](https://github.com/makyen/StackExchange-userscripts/raw/master/Roomba-Forecaster/README-assets/daily-20days.png) | ![weekly roomba](https://github.com/makyen/StackExchange-userscripts/raw/master/Roomba-Forecaster/README-assets/weekly-29days.png)

##Options
Clicking on the "roomba" status line will open an options dialog where you
can select what is displayed.  The following GIF shows how the display
looks with the various different options:  
![Roomba Forecaster options](https://github.com/makyen/StackExchange-userscripts/raw/master/Roomba-Forecaster/README-assets/options.gif)

Clicking on the <kbd>Close</kbd> button will keep the selected options for use on this page only. <kbd>Save</kbd> will store the options for use on all pages.

###Short descriptions in the status line
The optional short descriptions in the "roomba" status line are cryptic.   
![short reasons](https://github.com/makyen/StackExchange-userscripts/raw/master/Roomba-Forecaster/README-assets/short-reasons.png)  
The best way to learn what they mean is to match them up against what
is displayed in the larger table (either as a tooltip, or
always displayed).  
![short reasons](https://github.com/makyen/StackExchange-userscripts/raw/master/Roomba-Forecaster/README-assets/tooltip-short-reasons.png)

##Compatibility Notes
The tooltip is styled to look like a native tooltip in the browsers which were tested: Chrome, Firefox, Opera, and Edge. Thus, the tooltip will look slightly different in in each browser. The images above are from Chrome. 

----------------------------
<sup>1.  Actually, four Roomba tasks run weekly.  The other two only
affect questions migrated to another Stack Exchange site or from another site and rejected. While the script should detect these, the Stack Exchange system automatically forwards the page to the site where the question currently exists. Thus, unless something changes in how Stack Exchange shows such questions, it is unlikely that you will see one.</sup>

<sup>This is a fork of [RoombaForecast](https://github.com/Siguza/StackScripts/blob/master/RoombaForecast.user.js).</sup>

