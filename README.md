![Symbol Swapper](https://raw.githubusercontent.com/sonburn/symbol-swapper/master/images/logo.png)

Swap the selected symbols and/or symbol instances to another master, or swap entire libraries.

![Symbol Swapper](https://raw.githubusercontent.com/sonburn/symbol-swapper/master/images/symbol-swapper.png)

![Library Swapper](https://raw.githubusercontent.com/sonburn/symbol-swapper/master/images/library-swapper.png)

<a href="http://bit.ly/SketchRunnerWebsite">
	<img width="160" height="41" src="http://bit.ly/RunnerBadgeBlue" alt="runner-badge-blue">
</a>

<a href="https://www.paypal.me/sonburn">
	<img width="160" height="41" src="https://raw.githubusercontent.com/sonburn/symbol-organizer/master/images/donate.png">
</a>

# Usage

* cmd option shift w - Swap the selected symbols and/or symbol instances to another master
* cmd option shift b - Swap all symbols from one library to another

# Installation

## Automatic
Search for Symbol Swapper in [Sketchrunner](http://sketchrunner.com/) or [Sketch Toolbox](http://sketchtoolbox.com/) if you have one of those installed.

Once installed, Sketch will automatically notify you when an update is available (version 0.1 and later).

## Manual

1. Download and open symbol-swapper-master.zip
2. Navigate to Symbol Swapper.sketchplugin and copy/move to your plugins directory

To find your plugins directory...

1. In the Sketch menu, navigate to Plugins > Manage Plugins...
2. Click the cog in the lower left of the plugins window, and click Reveal Plugins Folder

# Changelog

* **0.24** - Fix for Sketch 72.
* **0.23** - Fix for application of tooltip causing error in population of symbols.
* **0.22** - Second attempt at fix for select box not populating correctly when swapping individual symbols.
* **0.21** - Fix for select box not populating correctly when swapping individual symbols.
* **0.20** - Improved select boxes when swapping instances, fixed broken check for updates after library swapping.
* **0.19** - Improved layout of library swapping window, added function to create inventory of a library.
* **0.18** - Fix for Sketch 58: plugin window closing when selecting library.
* **0.17** - Fix for Swap Libraries not working after last update.
* **0.16** - Fix for Swap Libraries not working if no local symbols.
* **0.15** - Fix for non-override instances of symbols not retaining their overrides.
* **0.14** - Added ability to swap libraries using symbol names instead of IDs.
* **0.13** - Fix for "alertWindow.buttons is not a function" issue introduced in last update.
* **0.12** - Library swapping window is now scrollable.
* **0.11** - Added support for migrating all symbols from current document to library, and added report for ignored symbols.
* **0.10** - Performance optimizations, bug fixes and support for Sketch 50.
* **0.9** - Fixed bug introduced in Sketch 48 as MSLayerPaster functionality was changed. Added new functionality to swap libraries individually.
* **0.8** - Symbol list for Let Me Choose is now sorted alphabetically, and allows for freeform searching.
* **0.7** - Added option to rename instances to master name, settings are now cached per document.
* **0.6** - When swapping a single selection, the match will be pre-selected in symbol list if found.
* **0.5** - Improved handling for when last used library no longer exists, improved performance when swapping siblings.
* **0.4** - Bug fixes for referencing current document.
* **0.3** - Added ability to choose a symbol of a different name, and to only swap selected instance (not siblings).
* **0.2** - Updated description in manifest.
* **0.1** - Initial commit.

# Contact

Find me on Twitter <a class="twitter-follow-button" href="https://twitter.com/sonburn">@sonburn</a>

# Support

If you find this plugin helpful, or would like to support my plugins in general, buy me ☕️ via <a href="https://www.paypal.me/sonburn">PayPal</a>.

# License

Copyright (c) 2021 Jason Burns (Sonburn). See LICENSE.md for further details.
