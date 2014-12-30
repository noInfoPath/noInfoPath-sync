"use strict";

describe("Testing noinfopath-sync.js", function() {
	
	//List of variables required for testing each section. These are up here due to the beforeEach loading the module for every test.
	var NOSYNC_CONSTANTS,
		nLS,
		$scope,
		$rootScope,
		$compile;

	//Every test needs to load the module.
	beforeEach(module("noinfopath.sync"));

	describe("Within noinfopath-sync, testing constants", function() {

		//NOTE: NOSYNC_CONSTANTS needs to be injected into each test. Hopefully there's a way to do this within a beforeEach, but proper method was not found.
		//Due to above note, no beforeEach required for this describe.

		it("should find 'NOSYNC_CONSTANTS'", inject(function(NOSYNC_CONSTANTS) {
            expect(NOSYNC_CONSTANTS).toBeDefined();
        }));

		it("should find 'NOSYNC_CONSTANTS.STATUS_CHANGED'", inject(function(NOSYNC_CONSTANTS) {
            expect(NOSYNC_CONSTANTS.STATUS_CHANGED).toBeDefined();
        }));

		it("should have the found constant to be equal to 'NoInfoPath::onlineStatusChanged'", inject(function(NOSYNC_CONSTANTS) {
            expect(NOSYNC_CONSTANTS.STATUS_CHANGED).toEqual('NoInfoPath::onlineStatusChanged');
        }));

	});

	describe("Within noinfopath-sync, testing provider named noOnlineStatus", function(){

	});

	describe("Within noinfopath-sync, testing directive named noStatus", function(){
		
		beforeEach(inject(function(_$compile_, _$rootScope_){
			// The injector unwraps the underscores (_) from around the parameter names when matching.
			$compile = _$compile_;
   			$rootScope = _$rootScope_;
   			
		}));

		it("should replace replace a html tag of <no-status> with a template", function(){

			//Makes the div tag to be replaced.
			// var element = $compile("<no-status></no-status>")($rootScope);

			// $rootScope.$digest();

			// expect(element.html()).toContain(" ");			

		});

	});

});