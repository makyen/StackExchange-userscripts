#Roomba Forecaster
[install](https://github.com/makyen/StackExchange-userscripts/raw/master/RoombaForecaster/RoombaForecaster.user.js)

Adds a "roomba" line under "viewed"/"active" in the top-right of question pages which shows if the question
is qualified to be deleted by [Roomba](http://stackoverflow.com/help/roomba).  How the information is diplayed is selectable through
options. The default is to display if the question is qualified to be Roomba'ed, and if so how long until it is deleted. Additional information
as to why a question is not qualified for Roomba is, by default, displayed in a tooltip:  
![tooltip](https://github.com/makyen/StackExchange-userscripts/raw/master/RoombaForecaster/README-assets/tooltip.png)
In addition, the default is to display if downvoting on the question  
![downvote question will roomba](https://github.com/makyen/StackExchange-userscripts/raw/master/RoombaForecaster/README-assets/downvote-question-will-roomba.png)
or answer(s):  
![downvote answer will roomba](https://github.com/makyen/StackExchange-userscripts/raw/master/RoombaForecaster/README-assets/downvote-question-will-roomba.png)
will qualify the question to be Roomba'ed: 

If the question will be deleted by Roomba, then the number of days until it is deleted is displayed. One roomba task runs daily:  
![daily roomba](https://github.com/makyen/StackExchange-userscripts/raw/master/RoombaForecaster/README-assets/daily-20days.png)
Two rooma tasks run weekly<sup>1</sup>  
![weekly roomba](https://github.com/makyen/StackExchange-userscripts/raw/master/RoombaForecaster/README-assets/weekly-29days.png)

Additional information as to why the question is not qualified for
Roomba is, by default, displayed tooltip-like upon hovering over the "roomba" line.  
![Roomba tooltip](https://github.com/makyen/StackExchange-userscripts/raw/master/RoombaForecaster/README-assets/.png)

##Options
Clicking on the 'roomba' line will open an options dialog where you
can select what is displayed.  The following gif shows how the display
looks with the various different options:  
![RoombaForecaster options](https://github.com/makyen/StackExchange-userscripts/raw/master/RoombaForecaster/README-assets/options.gif)

The optional short descritpions in the roomba status line are cryptic.   
![short reasons](https://github.com/makyen/StackExchange-userscripts/raw/master/RoombaForecaster/README-assets/short-reasons.png)
The best way to learn what they mean is to match them up against what
is displayed in the larger table (either as a tooltip, or
always displayed).
![short reasons](https://github.com/makyen/StackExchange-userscripts/raw/master/RoombaForecaster/README-assets/tooltip-short-reasons.png)

You can also select if you desire to use the Stack Exchange API to
obtain the data for the question, or to scrape the page.  All the data
is available in each question page.  Scraping the page is faster than
making an API request.  If you would prefer the data to be obtained
from the Stack exchange API, you can select to do so.  For power
users, it is possible you might be concerned about the overall number
of requests being made for all the scripts you are using.  If so,
scraping the page will consume none of your quota.






----------------------------
<sup>1.  Actualy, four Roomba tasks run weekly.  The other two only
affect questions migrated to or from the curent Stack Exchange site. 
While the code should detect these, doing so is untested due to the
Stack Exchange system automatically forwarding the page to the new
site when the question was migrated away from the current one, or to
the old site when the question was rejected from the current
one.</sup>

<sup>This is a fork of [RoombaForecast](https://github.com/Siguza/StackScripts/blob/master/RoombaForecast.user.js).</sup>

