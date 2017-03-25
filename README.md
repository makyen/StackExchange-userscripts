# User Scripts
This repository contains user scripts for use on Stack Exchange.  The scripts are
compatible with [Tampermonkey](http://tampermonkey.net/) (Chrome, Firefox, Opera Next, Safari, Microsoft Edge, Dolphin Browser, UC Browser, etc.) and [Greasemonkey](http://www.greasespot.net/) (Firefox). In general, they will have been tested in Chrome, Firefox, Opera and Edge.

##[Roomba Forecaster](https://github.com/makyen/StackExchange-userscripts/tree/master/Roomba-Forecaster) ([install](https://github.com/makyen/StackExchange-userscripts/raw/master/Roomba-Forecaster/RoombaForecaster.user.js))

Is Roomba going to delete the question? If not, why? If so, when?

Adds a "roomba" status line under "viewed"/"active" in the top-right of question pages which shows:

* If [Roomba](http://stackoverflow.com/help/roomba) will delete the question
* How long until the question is deleted
* Why the question won't be deleted (by default, displayed in a tooltip)
* If you down-voting on the question or answer(s) will qualify the question for Roomba

![Roomba Forecaster](https://github.com/makyen/StackExchange-userscripts/raw/master/Roomba-Forecaster/README-assets/larger-down-vote-question-will-roomba.png)
