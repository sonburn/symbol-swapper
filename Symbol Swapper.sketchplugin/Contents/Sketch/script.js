@import 'delegate.js';

const sketch = require('sketch');

var pluginName = 'Symbol Swapper';
var pluginIdentifier = 'com.sonburn.sketchplugins.symbol-swapper';
var debugMode = false;

var panelWidth = 350;
var panelHeight = 530;
var panelTitle = 44;
var gutterWidth = 15;
var uiButtons = [];
var swapButton;

var libraryPredicate = NSPredicate.predicateWithFormat('enabled == 1 && valid == 1');
var librarySort = NSSortDescriptor.sortDescriptorWithKey_ascending('name',1);
var libraries = AppController.sharedInstance().librariesController().libraries().filteredArrayUsingPredicate(libraryPredicate).sortedArrayUsingDescriptors([librarySort]);
var libraryLoop = libraries.objectEnumerator();
var library;
var libraryNames = ['Current Document'];
var librarySymbols;
var librarySelects = [];
var symbolArray;

while (library = libraryLoop.nextObject()) {
	libraryNames.push(String(library.name()));
}

var swapSelected = function(context) {
	var predicate = NSPredicate.predicateWithFormat('className == %@ || className == %@','MSSymbolMaster','MSSymbolInstance');
	var selections = context.selection.filteredArrayUsingPredicate(predicate);

	if (!selections.length) {
		sketch.UI.alert(pluginName,'Please select at least one symbol master or instance.');
		return;
	}

	var librarySettings = getLibrary(context);

	if (librarySettings) {
		var selectedLibrary = (librarySettings.selectedLibrary != 0) ? libraries[librarySettings.selectedLibrary - 1] : 0;
		var selectedMaster = librarySettings.selectedMaster;
		var selectionMaster;
		var symbolMaster;
		var instanceMap = {};
		var instanceCount = 0;

		selections.forEach(function(selection){
			var proceed = false;

			selectionMaster = (selection.class() == 'MSSymbolMaster') ? selection : selection.symbolMaster();

			if (selectedMaster) {
				symbolMaster = (selectedLibrary != 0) ? importForeignSymbol(selectedMaster,selectedLibrary).symbolMaster() : selectedMaster;

				instanceMap[selection.symbolID()] = symbolMaster.symbolID();

				proceed = true;
			} else {
				var selectionMasterName = selectionMaster.name();

				if (symbolArray.containsObject(selectionMasterName)) {
					var symbolIndex = symbolArray.indexOfObject(selectionMasterName);

					symbolMaster = (selectedLibrary != 0) ? importForeignSymbol(librarySymbols[symbolIndex],selectedLibrary).symbolMaster() : librarySymbols[symbolIndex];

					instanceMap[selection.symbolID()] = symbolMaster.symbolID();

					proceed = true;
				}
			}

			if (proceed) {
				if (selection.class() == 'MSSymbolMaster') {
					var instances = selection.allInstances();

					instances.forEach(function(instance){
						instance.changeInstanceToSymbol(symbolMaster);

						if (librarySettings.renameInstances == 1) {
							instance.setName(symbolMaster.name());
						}

						instanceCount++;
					});

					if (librarySettings.deleteMasters == 1) {
						selection.removeFromParent();
					}
				} else {
					selection.changeInstanceToSymbol(symbolMaster);

					if (librarySettings.renameInstances == 1) {
						selection.setName(symbolMaster.name());
					}

					instanceCount++;
				}
			}
		});

		if (librarySettings.includeSiblings == 1) {
			var symbolInstances = selectionMaster.allInstances();

			symbolInstances.forEach(function(instance){
				instance.changeInstanceToSymbol(symbolMaster);

				if (librarySettings.renameInstances == 1) {
					instance.setName(symbolMaster.name());
				}
			});

			if (Object.keys(instanceMap).length > 0) {
				getAllDocumentInstances(context).forEach(function(instance){
					if (MSLayerPaster.updateOverridesOnInstance_withIDMap_) {
						MSLayerPaster.updateOverridesOnInstance_withIDMap_(instance,instanceMap);
					} else {
						instance.updateOverridesWithObjectIDMap(instanceMap);
					}
				});
			}
		}

		context.document.reloadInspector();

		var libraryName = (selectedLibrary == 0) ? 'current document' : selectedLibrary.name() + ' library';

		sketch.UI.message(instanceCount + ' symbol instance(s) have been swapped to the ' + libraryName);
	}
}

var swapLibrary = function(context) {
	// const libraryController = AppController.sharedInstance().librariesController();

	const localSymbols = context.document.documentData().localSymbols();
	const foreignSymbols = context.document.documentData().foreignSymbols();

	if (debugMode) {
		log('There are ' + localSymbols.length + ' local symbols');
		log('There are ' + foreignSymbols.length + ' foreign symbols');
	}

	var defaultSettings = {};
	defaultSettings.librarySwapType = 1;

	defaultSettings = getCachedSettings(context,context.document.documentData(),defaultSettings);

	if (!localSymbols.length && !foreignSymbols.length) {
		sketch.UI.alert(pluginName,'There are no symbols to swap in the current document.');
		return false;
	}

	var alertWindow = createWindow(context,'Symbol Swap Libraries','Swap all symbols from one source to another.');

	let alertContent = NSView.alloc().init()
	alertContent.setFlipped(true)

	var libraryListContentWidth = 350;
	var libraryListContentGutter = 15;
	var libraryListItemWidth = libraryListContentWidth - libraryListContentGutter;
	var libraryListItemHeight = 92;
	var libraryListItemPadding = 12;
	var libraryList = createScrollView(NSMakeRect(0,0,0,0));
	var libraryListContent = createContentView(NSMakeRect(0,0,0,0));
	var libraryListItemCount = 0;
	var libraryListMaxDisplay = 3

	if (localSymbols.length) {
		var thisLibraryName = 'Current Document';
		var thisLibraryID = context.document.documentData().objectID();
		var thisLibraryCount = localSymbols.count();

		var libraryListItem = createContentView(NSMakeRect(0,libraryListItemCount*libraryListItemHeight,libraryListItemWidth,libraryListItemHeight));

		var libraryTitleText = createLabel(thisLibraryName,12,NSMakeRect(libraryListItemPadding,libraryListItemPadding,libraryListContentWidth,16),1);
		var libraryIDText = createLabel(thisLibraryID,12,NSMakeRect(libraryListItemPadding,32,libraryListContentWidth,16));
		var librarySelect = createLibrarySelect(libraryListItem,NSMakeRect(libraryListItemPadding,54,202,28));
		var libraryButton = createButton('Create Inventory',NSMakeRect(libraryListItemPadding+202,56,120,24));

		libraryButton.setCOSJSTargetFunction(function() {
			createInventoryPage(thisLibraryName,thisLibraryID);
		});

		[libraryTitleText,libraryIDText,librarySelect,libraryButton].forEach(i => libraryListItem.addSubview(i));

		libraryListContent.addSubview(libraryListItem);

		libraryListItemCount++;
	}

	if (foreignSymbols.length) {
		var foreignSymbolLibraries = NSMutableArray.array();

		foreignSymbols.forEach(foreignSymbol => {
			var foreignObject = {};

			foreignObject.name = String(foreignSymbol.sourceLibraryName());
			foreignObject.id = String(foreignSymbol.libraryID());

			if (!foreignSymbolLibraries.containsObject(foreignObject)) {
				foreignSymbolLibraries.addObject(foreignObject);
			}
		});

		if (debugMode) {
			log('Foreign libraries in use, pre sort…');
			log(foreignSymbolLibraries);
		}

		var foreignSymbolLibrarySort = NSSortDescriptor.sortDescriptorWithKey_ascending('name',1);
		foreignSymbolLibraries = foreignSymbolLibraries.sortedArrayUsingDescriptors([foreignSymbolLibrarySort]);

		if (debugMode) {
			log('Foreign libraries in use, post sort…');
			log(foreignSymbolLibraries);
		}

		foreignSymbolLibraries.forEach(foreignSymbolLibrary => {
			var thisLibraryName = foreignSymbolLibrary.name;
			var thisLibraryID = foreignSymbolLibrary.id;
			var thisLibraryCount = 0;

			foreignSymbols.forEach(foreignSymbol => {
				var foreignSymbolLibraryName = String(foreignSymbol.sourceLibraryName());
				var foreignSymbolLibraryID = String(foreignSymbol.libraryID());

				if (foreignSymbolLibraryName == thisLibraryName && foreignSymbolLibraryID == thisLibraryID) {
					thisLibraryCount++;
				}
			});

			var libraryListItem = createContentView(NSMakeRect(0,libraryListItemCount*libraryListItemHeight,libraryListItemWidth,libraryListItemHeight));

			var libraryTitleText;

			if (sketch.getLibraries().find(l => l.id == thisLibraryID)) {
				libraryTitleText = createLabel(`${thisLibraryName} (${thisLibraryCount})`,12,NSMakeRect(libraryListItemPadding,libraryListItemPadding,libraryListContentWidth,16),1);
			} else {
				libraryTitleText = createRedLabel(`${thisLibraryName} (${thisLibraryCount}) [Missing]`,12,NSMakeRect(libraryListItemPadding,libraryListItemPadding,libraryListContentWidth,16),1);
			}

			var libraryIDText = createLabel(thisLibraryID,12,NSMakeRect(libraryListItemPadding,32,libraryListContentWidth,16));
			var librarySelect = createLibrarySelect(alertWindow,NSMakeRect(libraryListItemPadding,54,202,28));
			var libraryButton = createButton('Create Inventory',NSMakeRect(libraryListItemPadding+202,56,120,24));

			libraryButton.setCOSJSTargetFunction(function() {
				createInventoryPage(thisLibraryName,thisLibraryID);
			});

			libraryListItem.addSubview(createListDivider(NSMakeRect(0,0,libraryListContentWidth,1)));

			[libraryTitleText,libraryIDText,librarySelect,libraryButton].forEach(i => libraryListItem.addSubview(i));

			libraryListContent.addSubview(libraryListItem);

			libraryListItemCount++;
		});
	}

	var libraryListContentHeight = libraryListItemHeight * libraryListItemCount;
	var libraryListHeight = (libraryListItemCount > libraryListMaxDisplay) ? libraryListItemHeight * libraryListMaxDisplay : libraryListContentHeight;

	libraryListContent.frame = NSMakeRect(0,0,libraryListItemWidth,libraryListContentHeight);
	libraryList.frame = NSMakeRect(0,0,libraryListContentWidth,libraryListHeight);
	libraryList.setDocumentView(libraryListContent);

	alertContent.addSubview(libraryList);

	var swapType = createRadioButtons(['Swap with symbols of same name','Swap with symbols of same ID'],defaultSettings.librarySwapType,null,null,CGRectGetMaxY(alertContent.subviews().lastObject().frame()) + 16);

	alertContent.addSubview(swapType);

	alertContent.frame = NSMakeRect(0,0,libraryListContentWidth,CGRectGetMaxY(swapType.frame()))

	alertWindow.accessoryView = alertContent

	swapButton = alertWindow.addButtonWithTitle('Swap');
	alertWindow.addButtonWithTitle('Cancel');

	swapButton.setEnabled(0);

	var responseCode = alertWindow.runModal();

	if (responseCode == 1000) {
		// Symbol variables
		var changedSymbolCount = 0;
		var ignoredLocalSymbols = NSMutableArray.array();
		var ignoredForeignSymbols = NSMutableArray.array();

		// Iterate through each library select...
		librarySelects.forEach(function(librarySelect,i){
			// If a new library was selected...
			if (librarySelect.indexOfSelectedItem() != 0) {
				// Library variables
				var selectedLibrary = librarySelect.indexOfSelectedItem() - 1; // Shifted to account for 'Swap to…'
				var selectedLibraryName = libraries[selectedLibrary].name();
				var selectedLibraryID = libraries[selectedLibrary].libraryID();

				// If user wants to swap symbols based on name...
				if (swapType.selectedCell().tag() == 0) {
					// Get the symbols from the library and create an array of symbol names
					var librarySymbols = getLibrarySymbols(libraries[selectedLibrary]);

					symbolArray = librarySymbols.valueForKey('name');
				}

				// If current document select was changed, and there are local symbols...
				if (i == 0 && localSymbols.length) {
					// Iterate through local symbols
					localSymbols.forEach(function(localSymbol){
						// Get matching foreign symbol, and symbol master
						var foreignSymbol = getForeignSymbolByName(localSymbol.name(),libraries[selectedLibrary]);
						var symbolMaster = (foreignSymbol) ? importForeignSymbol(foreignSymbol,libraries[selectedLibrary]).symbolMaster() : false;

						// If matching symbol exists...
						if (symbolMaster) {
							// Iterate through instances
							localSymbol.allInstances().forEach(function(instance){
								instance.changeInstanceToSymbol(symbolMaster);
								instance.setName(symbolMaster.name());
							});

							// Remove local symbol
							localSymbol.removeFromParent();

							// Iterate the changed symbol counter
							changedSymbolCount++;
						}
						// If matching symbol doesn't exist...
						else {
							// Ignore the symbol
							ignoredLocalSymbols.addObject(localSymbol);
						}
					});
				}
				// If foreign library select was changed...
				else {
					// Library variables
					var currentLibraryName = (localSymbols.length) ? foreignSymbolLibraries[i - 1].name : foreignSymbolLibraries[i].name;
					var currentLibraryID = (localSymbols.length) ? foreignSymbolLibraries[i - 1].id : foreignSymbolLibraries[i].id;

					// Iterate through foreign symbols
					foreignSymbols.forEach(function(foreignSymbol){
						// Foreign library variables
						var foreignSymbolLibraryName = String(foreignSymbol.sourceLibraryName());
						var foreignSymbolLibraryID = String(foreignSymbol.libraryID());

						// If the foreign symbol's library name & ID match the selected library...
						if (foreignSymbolLibraryName == currentLibraryName && foreignSymbolLibraryID == currentLibraryID) {
							// Library index variable
							var libraryIndex;

							// Iterate through the libraries
							for (j = 0; j < libraries.length; j++) {
								// If this library is the same as the selected library...
								if (String(libraries[j].name()) == selectedLibraryName && String(libraries[j].libraryID()) == selectedLibraryID) {
									// Update the library index variable
									libraryIndex = j;
								}
							}

							// If user wants to swap symbols based on name...
							if (swapType.selectedCell().tag() == 0) {
								// If matching symbol exists...
								if (symbolArray.containsObject(foreignSymbol.symbolMaster().name())) {
									// Get the matched symbol from the selected library
									var librarySymbol = librarySymbols.objectAtIndex(symbolArray.indexOfObject(foreignSymbol.symbolMaster().name()));

									// Update the foreign symbol
									foreignSymbol.setLibraryID(selectedLibraryID);
									foreignSymbol.setSourceLibraryName(selectedLibraryName);
									foreignSymbol.originalMaster().setSymbolID(librarySymbol.symbolID());

									// Iterate the changed symbol counter
									changedSymbolCount++;
								}
								// If matching symbol doesn't exist...
								else {
									// Ignore the symbol
									ignoredForeignSymbols.addObject(foreignSymbol);
								}
							} else {
								// If matching symbol exists...
								if (foreignSymbol.masterFromLibrary(libraries.objectAtIndex(libraryIndex))) {
									// Update the foreign symbol
									foreignSymbol.setLibraryID(selectedLibraryID);
									foreignSymbol.setSourceLibraryName(selectedLibraryName);

									// libraryController.syncForeignObject_withMaster_fromLibrary(
									// 	foreignSymbol,
									// 	null,
									// 	libraryController.libraryForShareableObject(foreignSymbol.symbolMaster())
									// )

									// Iterate the changed symbol counter
									changedSymbolCount++;
								}
								// If matching symbol doesn't exist...
								else {
									// Ignore the symbol
									ignoredForeignSymbols.addObject(foreignSymbol);
								}
							}
						}
					});
				}
			}
		});

		context.command.setValue_forKey_onLayer(swapType.selectedCell().tag(),'librarySwapType',context.document.documentData());

		// Check for library updates to accept
		if (sketch.version.sketch > 59) {
			AppController.sharedInstance().librariesController().checkForRemoteAssetLibraryUpdates();
		} else {
			AppController.sharedInstance().checkForAssetLibraryUpdates();
		}

		if (ignoredLocalSymbols.count() == 0 && ignoredForeignSymbols.count() == 0) {
			sketch.UI.alert(pluginName,changedSymbolCount + ' symbols have been swapped to new libraries.\n\nYou may need to accept the library updates by clicking the Library Updates Available button in the top-right corner of Sketch.');
		} else {
			var alertText = changedSymbolCount + " symbols have been swapped to new libraries.\n\nYou may need to accept the library updates by clicking the Library Updates Available button in the top-right corner of Sketch.\n\nSome symbols were ignored as they weren't found in the selected libraries. Click View Report to review the ignored symbols.";
			var alertWindow = createAlertWindow(context,'Symbol Swap Libraries',alertText);

			alertWindow.addButtonWithTitle('View Report');
			alertWindow.addButtonWithTitle('Dismiss');

			var responseCode = alertWindow.runModal();

			if (responseCode == 1000) {
				displayIgnoredSymbols(ignoredLocalSymbols,ignoredForeignSymbols);

				if (!debugMode) googleAnalytics(context,'swap','ignored');
			} else return false;
		}

		if (!debugMode) googleAnalytics(context,'swap','library');
	} else return false;
}

var report = function(context) {
	openUrl('https://github.com/sonburn/symbol-swapper/issues/new');

	if (!debugMode) googleAnalytics(context,'report','report');
}

var plugins = function(context) {
	openUrl('https://sonburn.github.io/');

	if (!debugMode) googleAnalytics(context,'plugins','plugins');
}

var donate = function(context) {
	openUrl('https://www.paypal.me/sonburn');

	if (!debugMode) googleAnalytics(context,'donate','donate');
}

function createAlertWindow(context,name,text) {
	var alertWindow = COSAlertWindow.new();

	var iconPath = context.plugin.urlForResourceNamed('icon.png').path();
	var icon = NSImage.alloc().initByReferencingFile(iconPath);

	alertWindow.setIcon(icon);
	alertWindow.setMessageText(name);

	if (text) { alertWindow.setInformativeText(text); }

	return alertWindow;
}

function createWindow(context,name,text) {
	let alert = NSAlert.alloc().init()
	let iconPath = context.plugin.urlForResourceNamed('icon.png').path()
	let icon = NSImage.alloc().initByReferencingFile(iconPath)

	alert.setIcon(icon)
	alert.setMessageText(name)

	if (text) alert.setInformativeText(text)

	return alert
}

function createButton(label,frame) {
	var button = NSButton.alloc().initWithFrame(frame);

	button.setTitle(label);
	button.setBezelStyle(NSRoundedBezelStyle);
	button.setAction('callAction:');

	return button;
}

function createCheckbox(item,flag,frame) {
	var checkbox = NSButton.alloc().initWithFrame(frame);
	var flag = (flag == false) ? NSOffState : NSOnState;

	checkbox.setButtonType(NSSwitchButton);
	checkbox.setBezelStyle(0);
	checkbox.setTitle(item.name);
	checkbox.setTag(item.value);
	checkbox.setState(flag);

	return checkbox;
}

function createContentView(frame,background) {
	var view = NSView.alloc().initWithFrame(frame);

	view.setFlipped(1);

	if (background) {
		view.setWantsLayer(1);
		view.layer().setBackgroundColor(CGColorCreateGenericRGB(248/255,248/255,248/255,1.0));
	}

	return view;
}

function createInventoryPage(pageName,libraryID) {
	var document = sketch.getSelectedDocument();
	var data = document.sketchObject.documentData();
	var symbols;

	if (pageName == 'Current Document' && libraryID == data.objectID()) {
		symbols = data.localSymbols();
	} else {
		symbols = NSMutableArray.array();

		data.foreignSymbols().forEach(symbol => {
			if (String(symbol.libraryID()) == libraryID) {
				symbols.push(symbol.symbolMaster());
			}
		});
	}

	symbols.sort((a,b) => (a.name() > b.name()) ? 1 : -1);

	var newPage = new sketch.Page({
		name : 'Symbols from ' + pageName,
		parent : document,
		selected : true
	});

	var lastX = 0;
	var space = 100;

	symbols.forEach(s => {
		let symbol = sketch.fromNative(s);

		let instance = new sketch.SymbolInstance({
			name : symbol.name,
			symbolId : symbol.symbolId,
			parent : document.selectedPage
		});

		instance.frame.x = lastX;
		instance.frame.y = 0;
		instance.frame.width = symbol.frame.width;
		instance.frame.height = symbol.frame.height;

		lastX = lastX + instance.frame.width + space;
	});

	sketch.UI.message('"Symbols from ' + pageName + '" page has been created');
}

function createLabel(text,size,frame,bold) {
	var label = NSTextField.alloc().initWithFrame(frame);

	label.setStringValue(text);
	(bold && bold == 1) ? label.setFont(NSFont.boldSystemFontOfSize(size)) : label.setFont(NSFont.systemFontOfSize(size));
	label.setBezeled(false);
	label.setDrawsBackground(false);
	label.setEditable(false);
	label.setSelectable(true);

	return label;
}

function createRedLabel(text,size,frame,bold) {
	var label = NSTextField.alloc().initWithFrame(frame);

	label.setStringValue(text);
	(bold && bold == 1) ? label.setFont(NSFont.boldSystemFontOfSize(size)) : label.setFont(NSFont.systemFontOfSize(size));
	label.setBezeled(false);
	label.setDrawsBackground(false);
	label.setEditable(false);
	label.setSelectable(true);
	label.setTextColor(NSColor.colorWithCalibratedRed_green_blue_alpha(255/255,0/255,0/255,1));

	return label;
}

function createLibrarySelect(alertWindow,frame) {
	var librarySelect = createDropdown(libraryNames,0,frame);

	librarySelect.removeItemAtIndex(0);
	librarySelect.insertItemWithTitle_atIndex('Swap to…',0);
	//librarySelect.insertItemWithTitle_atIndex('Current Document',1);
	librarySelect.selectItemAtIndex(0);

	librarySelect.setCOSJSTargetFunction(function() {
		if (librarySelect.indexOfSelectedItem() != 0) {
			swapButton.setEnabled(1);
		} else {
			var nothingSelected = true;

			for (i = 0; i < librarySelects.length; i++) {
				if (librarySelects[i].indexOfSelectedItem() != 0) {
					nothingSelected = false;
				}
			}

			if (nothingSelected) {
				swapButton.setEnabled(0);
			}
		}
	});

	librarySelects.push(librarySelect);

	return librarySelect;
}

function createListDivider(frame) {
	var divider = NSView.alloc().initWithFrame(frame);

	divider.setWantsLayer(1);
	divider.layer().setBackgroundColor(CGColorCreateGenericRGB(204/255,204/255,204/255,1.0));

	return divider;
}

function createListImage(instance,frame) {
	var imageArea = NSButton.alloc().initWithFrame(frame);

	imageArea.setTitle('');
	imageArea.setBordered(0);
	imageArea.setWantsLayer(1);
	imageArea.layer().setBackgroundColor(CGColorCreateGenericRGB(248/255,248/255,248/255,1.0));

	var exportRequest = MSExportRequest.exportRequestsFromExportableLayer_inRect_useIDForName_(
		instance,
		instance.absoluteInfluenceRect(),
		false
		).firstObject();

	exportRequest.format = 'png';

	var scaleX = (frame.size.width-4*2) / exportRequest.rect().size.width;
	var scaleY = (frame.size.height-4*2) / exportRequest.rect().size.height;

	exportRequest.scale = (scaleX < scaleY) ? scaleX : scaleY;

	var colorSpace = NSColorSpace.sRGBColorSpace();
	var exporter = MSExporter.exporterForRequest_colorSpace_(exportRequest,colorSpace);
	var imageRep = exporter.bitmapImageRep();
	var instanceImage = NSImage.alloc().init().autorelease();

	instanceImage.addRepresentation(imageRep);

	imageArea.setImage(instanceImage);

	return imageArea;
}

function createListItem(symbol,frame) {
	var listItem = NSView.alloc().initWithFrame(frame);
	var rightColWidth = 100;
	var leftColWidth = frame.size.width-rightColWidth;
	var leftPad = 8;

	listItem.setFlipped(1);

	if (symbol.class() == 'MSSymbolMaster') {
		listItem.addSubview(createListLabel('Page',NSMakeRect(leftPad,8,leftColWidth,14)));
		listItem.addSubview(createListField(symbol.parentPage().name(),NSMakeRect(leftPad,20,leftColWidth-leftPad,18)));
		listItem.addSubview(createListLabel('Symbol',NSMakeRect(leftPad,36,leftColWidth,14)));
		listItem.addSubview(createListField(symbol.name(),NSMakeRect(leftPad,48,leftColWidth-leftPad,18)));
		listItem.addSubview(createListImage(symbol,NSMakeRect(leftColWidth,0,rightColWidth,frame.size.height)));
		listItem.addSubview(createListDivider(NSMakeRect(0,frame.size.height-1,frame.size.width,1)));
		listItem.addSubview(createListTarget(symbol,NSMakeRect(0,0,frame.size.width,frame.size.height)));
	} else {
		listItem.addSubview(createListLabel('Symbol',NSMakeRect(leftPad,24,leftColWidth,14)));
		listItem.addSubview(createListField(symbol.symbolMaster().name(),NSMakeRect(leftPad,36,leftColWidth-leftPad,18)));
		listItem.addSubview(createListImage(symbol.symbolMaster(),NSMakeRect(leftColWidth,0,rightColWidth,frame.size.height)));
		listItem.addSubview(createListDivider(NSMakeRect(0,frame.size.height-1,frame.size.width,1)));
	}

	return listItem;
}

function createListField(string,frame) {
	var textField = NSTextField.alloc().initWithFrame(frame);

	textField.setStringValue(string);
	textField.setFont(NSFont.systemFontOfSize(11));
	textField.setBezeled(0);
	textField.setEditable(0);
	textField.setLineBreakMode(NSLineBreakByTruncatingTail);

	return textField;
}

function createListLabel(string,frame) {
	var textLabel = NSTextField.alloc().initWithFrame(frame);

	textLabel.setStringValue(string);
	textLabel.setFont(NSFont.systemFontOfSize(9));
	textLabel.setTextColor(NSColor.colorWithCalibratedRed_green_blue_alpha(0/255,0/255,0/255,0.4));
	textLabel.setBezeled(0);
	textLabel.setEditable(0);

	return textLabel;
}

function createListTarget(symbol,frame) {
	var targetArea = NSButton.alloc().initWithFrame(frame);

	uiButtons.push(targetArea);

	targetArea.addCursorRect_cursor(targetArea.frame(),NSCursor.pointingHandCursor());
	targetArea.setTransparent(1);
	targetArea.setAction('callAction:');
	targetArea.setCOSJSTargetFunction(sender => {
		deselectListItems(uiButtons);

		sender.setWantsLayer(1);
		sender.layer().setBorderWidth(2);
		sender.layer().setBorderColor(CGColorCreateGenericRGB(0,0,1,1));

		var rect = (symbol.parentArtboard()) ? symbol.parentArtboard().rect() : symbol.absoluteRect().rect();

		MSDocument.currentDocument().setCurrentPage(symbol.parentPage());
		MSDocument.currentDocument().contentDrawView().zoomToFitRect(rect);

		symbol.select_byExpandingSelection(true,false);
	});

	return targetArea;
}

function createListView(symbols) {
	uiButtons = [];

	var itemHeight = 72;
	var itemWidth = panelWidth - gutterWidth;
	var listView = NSView.alloc().initWithFrame(NSMakeRect(0,0,itemWidth,itemHeight*symbols.length));
	var count = 0;

	listView.setFlipped(true);

	for (var i = 0; i < symbols.length; i++) {
		var listItem = createListItem(symbols[i],NSMakeRect(0,itemHeight*count,itemWidth,itemHeight));

		listView.addSubview(listItem);

		count++;
	}

	return listView;
}

function createRadioButtons(options,selected,format,x,y) {
	var rows = options.length;
	var columns = 1;
	var buttonMatrixWidth = 300;
	var buttonCellWidth = buttonMatrixWidth;
	var x = (x) ? x : 0;
	var y = (y) ? y : 0;

	if (format && format != 0) {
		rows = options.length / 2;
		columns = 2;
		buttonMatrixWidth = 300;
		buttonCellWidth = buttonMatrixWidth / columns;
	}

	var buttonCell = NSButtonCell.alloc().init();

	buttonCell.setButtonType(NSRadioButton);

	var buttonMatrix = NSMatrix.alloc().initWithFrame_mode_prototype_numberOfRows_numberOfColumns(
		NSMakeRect(x,y,buttonMatrixWidth,rows*20),
		NSRadioModeMatrix,
		buttonCell,
		rows,
		columns
	);

	buttonMatrix.setCellSize(NSMakeSize(buttonCellWidth,20));

	for (i = 0; i < options.length; i++) {
		buttonMatrix.cells().objectAtIndex(i).setTitle(options[i]);
		buttonMatrix.cells().objectAtIndex(i).setTag(i);
	}

	buttonMatrix.selectCellAtRow_column(selected,0);

	return buttonMatrix;
}

function createSegmentedControl(items,frame) {
	var control = NSSegmentedControl.alloc().initWithFrame(frame);

	control.setSegmentCount(items.length);

	items.forEach(function(item,index) {
		control.setLabel_forSegment(item,index);
		control.setWidth_forSegment(120,index);
	});

	control.cell().setTrackingMode(0);
	control.setSelected_forSegment(1,0);

	return control;
}

function createDropdown(items,index,frame) {
	var select = NSPopUpButton.alloc().initWithFrame(frame);

	select.addItemsWithTitles(items);
	select.selectItemAtIndex(index);
	select.setFont(NSFont.systemFontOfSize(12));

	return select;
}

function createSelect(items,index,frame) {
	var select = NSComboBox.alloc().initWithFrame(frame);
	var selectItem = (index > -1) ? index : 0;

	select.addItemsWithObjectValues(items);
	select.selectItemAtIndex(selectItem);
	select.setNumberOfVisibleItems(16);
	select.setCompletes(1);
	//select.setEditable(0);

	return select;
}

function createScrollView(frame) {
	var view = NSScrollView.alloc().initWithFrame(frame);

	view.setHasVerticalScroller(1);

	return view;
}

function deselectListItems(items) {
	for (var i = 0; i < items.length; i++) {
		if (items[i].layer()) {
			items[i].layer().setBorderWidth(0);
			items[i].setWantsLayer(0);
		}
	}
}

function displayIgnoredSymbols(ignoredLocalSymbols,ignoredForeignSymbols) {
	var panel = NSPanel.alloc().init();

	panel.setFrame_display(NSMakeRect(0,0,panelWidth,panelHeight),true);
	panel.setStyleMask(NSTexturedBackgroundWindowMask | NSTitledWindowMask | NSClosableWindowMask | NSFullSizeContentViewWindowMask);
	panel.setBackgroundColor(NSColor.controlColor());
	panel.setLevel(NSFloatingWindowLevel);
	panel.standardWindowButton(NSWindowMiniaturizeButton).setHidden(true);
	panel.standardWindowButton(NSWindowZoomButton).setHidden(true);
	panel.makeKeyAndOrderFront(null);
	panel.center();
	panel.title = pluginName;

	COScript.currentCOScript().setShouldKeepAround_(true);

	var threadDictionary = NSThread.mainThread().threadDictionary();
	var identifier = pluginIdentifier;

	if (threadDictionary[identifier]) return;

	threadDictionary[identifier] = panel;

	var closeButton = panel.standardWindowButton(NSWindowCloseButton);

	closeButton.setCOSJSTargetFunction(function() {
		panel.close();
		threadDictionary.removeObjectForKey(identifier);
		COScript.currentCOScript().setShouldKeepAround_(false);
	});

	var panelContent = NSView.alloc().initWithFrame(NSMakeRect(0,0,panelWidth,panelHeight-panelTitle));

	panelContent.setFlipped(1);

	var panelIntro = createLabel('Ignored Symbol Report',12,NSMakeRect(8,12,panelWidth-16,16),1);

	panelContent.addSubview(panelIntro);

	var panelToggle = createSegmentedControl(['Local (' + ignoredLocalSymbols.length + ')','Foreign (' + ignoredForeignSymbols.length + ')'],NSMakeRect(52,38,300,24));

	panelContent.addSubview(panelToggle);

	var panelText = createLabel('Select a symbol below to navigate to it\'s location…',12,NSMakeRect(8,72,panelWidth-16,16));

	panelContent.addSubview(panelText);

	var panelList = NSScrollView.alloc().initWithFrame(NSMakeRect(0,102,panelWidth,384));

	panelList.setHasVerticalScroller(true);

	panelContent.addSubview(panelList);

	var symbols = ignoredLocalSymbols;

	if (!ignoredForeignSymbols.length) {
		panelToggle.setEnabled_forSegment(0,1);
		panelToggle.setSelected_forSegment(1,0);
	} else if (!ignoredLocalSymbols.length) {
		panelToggle.setEnabled_forSegment(0,0);
		panelToggle.setSelected_forSegment(1,1);

		panelText.setStringValue('Foreign symbols are not selectable, for review only…');

		symbols = ignoredForeignSymbols;
	} else {
		panelToggle.cell().setAction('callAction:');
		panelToggle.cell().setCOSJSTargetFunction(sender => {
			symbols = (sender.indexOfSelectedItem() == 0) ? ignoredLocalSymbols : ignoredForeignSymbols;

			var panelTextString = (sender.indexOfSelectedItem() == 0) ? 'Select a symbol below to navigate to it\'s location…' : 'Library symbols are unselectable, for review only…';

			panelText.setStringValue(panelTextString);

			var panelListContent = createListView(symbols);

			panelList.setDocumentView(panelListContent);
		});
	}

	var panelListContent = createListView(symbols);

	panelList.setDocumentView(panelListContent);

	panel.contentView().addSubview(panelContent);
}

function googleAnalytics(context,category,action,label,value) {
	var trackingID = 'UA-118995931-1';
	var uuidKey = 'google.analytics.uuid';
	var uuid = NSUserDefaults.standardUserDefaults().objectForKey(uuidKey);

	if (!uuid) {
		uuid = NSUUID.UUID().UUIDString();
		NSUserDefaults.standardUserDefaults().setObject_forKey(uuid,uuidKey);
	}

	var url = 'https://www.google-analytics.com/collect?v=1';
	// Tracking ID
	url += '&tid=' + trackingID;
	// Source
	url += '&ds=sketch' + sketch.version.sketch;
	// Client ID
	url += '&cid=' + uuid;
	// pageview, screenview, event, transaction, item, social, exception, timing
	url += '&t=event';
	// App Name
	url += '&an=' + encodeURI(context.plugin.name());
	// App ID
	url += '&aid=' + context.plugin.identifier();
	// App Version
	url += '&av=' + context.plugin.version();
	// Event category
	url += '&ec=' + encodeURI(category);
	// Event action
	url += '&ea=' + encodeURI(action);
	// Event label
	if (label) {
		url += '&el=' + encodeURI(label);
	}
	// Event value
	if (value) {
		url += '&ev=' + encodeURI(value);
	}

	var session = NSURLSession.sharedSession();
	var task = session.dataTaskWithURL(NSURL.URLWithString(NSString.stringWithString(url)));

	task.resume();
}

function getCachedSettings(context,location,settings) {
	try {
		for (i in settings) {
			var value = context.command.valueForKey_onLayer_forPluginIdentifier(i,location,pluginIdentifier);
			if (value) settings[i] = value;
		}

		return settings;
	} catch(err) {
		log(strProblemFetchingSettings);
	}
}

function getAllDocumentInstances() {
	var instanceArray = NSArray.array();
	var predicate = NSPredicate.predicateWithFormat('className == %@','MSSymbolInstance');

	MSDocument.currentDocument().pages().forEach(function(page){
		var pageInstances = page.children().filteredArrayUsingPredicate(predicate);

		instanceArray = instanceArray.arrayByAddingObjectsFromArray(pageInstances);
	});

	return instanceArray;
}

function getLibrary(context) {
	var lastLibrary = context.command.valueForKey_onLayer('lastLibrary',context.document.documentData());
	var library = 0;
	var selectLibrary = 0;
	var selectSymbol = 0;

	if (lastLibrary && lastLibrary != 0) {
		var predicate = NSPredicate.predicateWithFormat('name == %@',lastLibrary);
		var libraryMatch = libraries.filteredArrayUsingPredicate(predicate).firstObject();

		if (libraryMatch) {
			library = libraryMatch;
			selectLibrary = libraryNames.indexOf(lastLibrary.trim());
		}
	}

	librarySymbols = getLibrarySymbols(library);
	symbolArray = (librarySymbols && librarySymbols.length) ? librarySymbols.valueForKey('name') : NSMutableArray.arrayWithArray(['No Symbols']);

	var defaultSettings = {};
	defaultSettings.includeSiblings = 1;
	defaultSettings.renameInstances = 1;
	defaultSettings.deleteMasters = 1;

	defaultSettings = getCachedSettings(context,context.document.documentData(),defaultSettings);

	var alertWindow = createAlertWindow(context,'Symbol Swap Selections','Swap the selected symbols and/or symbol instances to another master.');

	alertWindow.addTextLabelWithValue('Select a new symbol source...');

	var symbolSource = createDropdown(libraryNames,selectLibrary,NSMakeRect(0,0,300,28));
	alertWindow.addAccessoryView(symbolSource);

	symbolSource.setCOSJSTargetFunction(function() {
		var selectedLibrary = (symbolSource.indexOfSelectedItem() == 0) ? 0 : libraries[symbolSource.indexOfSelectedItem() - 1];

		librarySymbols = getLibrarySymbols(selectedLibrary);

		if (librarySymbols && librarySymbols.length) {
			symbolArray = librarySymbols.valueForKey('name');
			swapButton.setEnabled(1);
		} else {
			symbolArray = NSMutableArray.arrayWithArray(['No Symbols']);
			swapButton.setEnabled(0);
		}

		symbolMaster.removeAllItems();
		symbolMaster.addItemsWithObjectValues(symbolArray);

		if (context.selection.length == 1) {
			var symbolName = (context.selection[0].class() == 'MSSymbolMaster') ? context.selection[0].name() : context.selection[0].symbolMaster().name();

			if (symbolArray.containsObject(symbolName)) {
				symbolMaster.selectItemAtIndex(symbolArray.indexOfObject(symbolName));
			} else {
				symbolMaster.selectItemAtIndex(0);
			}
		}
	});

	var swapType = createRadioButtons(['Swap with symbol of same name','Swap with symbol of same ID','Let me choose...'],0);
	alertWindow.addAccessoryView(swapType);

	swapType.cells().objectAtIndex(0).setAction('callAction:');
	swapType.cells().objectAtIndex(0).setCOSJSTargetFunction(function() {
		if (context.selection.length == 1) {
			var symbolName = (context.selection[0].class() == 'MSSymbolMaster') ? context.selection[0].name() : context.selection[0].symbolMaster().name();

			if (symbolArray.containsObject(symbolName)) {
				selectSymbol = symbolArray.indexOfObject(symbolName);
			}

			symbolMaster.selectItemAtIndex(selectSymbol);
		}

		symbolMaster.setEnabled(0);
	});

	swapType.cells().objectAtIndex(1).setAction('callAction:');
	swapType.cells().objectAtIndex(1).setCOSJSTargetFunction(function() {
		if (context.selection.length == 1) {
			var symbolID = (context.selection[0].class() == 'MSSymbolMaster') ? context.selection[0].symbolID() : context.selection[0].symbolMaster().symbolID();

			if (symbolArray.containsObject(symbolID)) {
				selectSymbol = symbolArray.indexOfObject(symbolID);
			}

			symbolMaster.selectItemAtIndex(selectSymbol);
		}

		symbolMaster.setEnabled(0);
	});

	swapType.cells().objectAtIndex(2).setAction('callAction:');
	swapType.cells().objectAtIndex(2).setCOSJSTargetFunction(function() {
		symbolMaster.setEnabled(1);
	});

	if (context.selection.length == 1) {
		var symbolName = (context.selection[0].class() == 'MSSymbolMaster') ? context.selection[0].name() : context.selection[0].symbolMaster().name();

		if (symbolArray.containsObject(symbolName)) {
			selectSymbol = symbolArray.indexOfObject(symbolName);
		}
	}

	var symbolMaster = createSelect(symbolArray,selectSymbol,NSMakeRect(0,0,300,26));
	alertWindow.addAccessoryView(symbolMaster);

	symbolMaster.setEnabled(0);

	if (symbolMaster.numberOfItems() > 0) {
		symbolMaster.setToolTip(symbolArray[symbolMaster.indexOfSelectedItem()]);
	}

	// Create the symbol master delegate
	var symbolMasterDelegate = new MochaJSDelegate({
		"comboBoxSelectionDidChange:" : (function() {
			var tooltip = (symbolMaster.numberOfItems() > 0) ? symbolArray[symbolMaster.indexOfSelectedItem()] : '';

			symbolMaster.setToolTip(tooltip);
		})
	});

	// Append the delegate to the symbol master
	symbolMaster.setDelegate(symbolMasterDelegate.getClassInstance());

	var includeSiblings = createCheckbox({name:'Swap siblings & overrides of selected instances',value:1},defaultSettings.includeSiblings,NSMakeRect(0,0,300,16));
	alertWindow.addAccessoryView(includeSiblings);

	var renameInstances = createCheckbox({name:'Rename instances to new master name',value:1},defaultSettings.renameInstances,NSMakeRect(0,0,300,16));
	alertWindow.addAccessoryView(renameInstances);

	var deleteMasters = createCheckbox({name:'Remove selected masters after swap',value:1},defaultSettings.deleteMasters,NSMakeRect(0,0,300,16));
	alertWindow.addAccessoryView(deleteMasters);

	var swapButton = alertWindow.addButtonWithTitle('Swap');

	if (librarySymbols && librarySymbols.length) {
		swapButton.setEnabled(1);
	} else {
		swapButton.setEnabled(0);
	}

	alertWindow.addButtonWithTitle('Cancel');

	var responseCode = alertWindow.runModal();

	if (responseCode == 1000) {
		var valueForLibrary = (symbolSource.indexOfSelectedItem() == 0) ? 0 : libraryNames[symbolSource.indexOfSelectedItem()];

		context.command.setValue_forKey_onLayer(valueForLibrary,'lastLibrary',context.document.documentData());
		context.command.setValue_forKey_onLayer(includeSiblings.state(),'includeSiblings',context.document.documentData());
		context.command.setValue_forKey_onLayer(renameInstances.state(),'renameInstances',context.document.documentData());
		context.command.setValue_forKey_onLayer(deleteMasters.state(),'deleteMasters',context.document.documentData());

		if (!debugMode) googleAnalytics(context,'swap','symbol');

		return {
			selectedLibrary : symbolSource.indexOfSelectedItem(),
			selectedMaster : (swapType.selectedCell().tag() == 2) ? librarySymbols[symbolMaster.indexOfSelectedItem()] : null,
			includeSiblings : includeSiblings.state(),
			renameInstances : renameInstances.state(),
			deleteMasters : deleteMasters.state()
		}
	} else return false;
}

function getLibrarySymbols(library) {
	var librarySymbolSort = NSSortDescriptor.sortDescriptorWithKey_ascending('name',1);
	var librarySymbols;

	if (library == 0) {
		librarySymbols = MSDocument.currentDocument().documentData().localSymbols();
	} else {
		var libraryPath = NSURL.fileURLWithPath(library.locationOnDisk().path());
		var libraryFile = openFile(libraryPath);

		librarySymbols = (libraryFile) ? libraryFile.documentData().allSymbols() : nil;

		libraryFile.close();
	}

	return librarySymbols.sortedArrayUsingDescriptors([librarySymbolSort]);
}

function getForeignSymbolByName(name,library) {
	var librarySymbols = getLibrarySymbols(library);
	var librarySymbolLoop = librarySymbols.objectEnumerator();
	var librarySymbol;
	var foreignSymbol;

	while (librarySymbol = librarySymbolLoop.nextObject()) {
		if (!foreignSymbol && librarySymbol.name().trim() == name.trim()) {
			foreignSymbol = librarySymbol;
		}
	}

	return foreignSymbol;
}

function importForeignSymbol(symbol,library) {
	var intoDocument = MSDocument.currentDocument().documentData();
	var libraryController = AppController.sharedInstance().librariesController();
	var foreignSymbol;

	if (sketch.version.sketch >= 50) {
		var objectReference = MSShareableObjectReference.referenceForShareableObject_inLibrary(symbol,library);

		foreignSymbol = libraryController.importShareableObjectReference_intoDocument(objectReference,intoDocument);
	} else {
		foreignSymbol = libraryController.importForeignSymbol_fromLibrary_intoDocument_(symbol,library,intoDocument);
	}

	return foreignSymbol;
}

function openFile(path) {
	var file = MSDocument.new();

	return (file.readFromURL_ofType_error(path,'com.bohemiancoding.sketch.drawing',nil)) ? file : nil;
}

function openUrl(url) {
	NSWorkspace.sharedWorkspace().openURL(NSURL.URLWithString(url));
}
