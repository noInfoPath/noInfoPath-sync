"use strict";

describe("Testing noinfopath-sync.js", function() {
	
	//List of variables required for testing each section. These are up here due to the beforeEach loading the module for every test.
	var NOSYNC_CONSTANTS,
		noOnlineStatus,
		noStatus,
		$scope,
		$rootScope,
		$compile;

	//Every test needs to load the module.
	beforeEach(module("noinfopath.sync"));

	describe("Within noinfopath-sync, testing constants", function() {

		beforeEach(inject(function(_NOSYNC_CONSTANTS_){
			NOSYNC_CONSTANTS = _NOSYNC_CONSTANTS_;
		}));

		it("should find 'NOSYNC_CONSTANTS'", function() {
            expect(NOSYNC_CONSTANTS).toBeDefined();
        });

		it("should find 'NOSYNC_CONSTANTS.STATUS_CHANGED'", function() {
            expect(NOSYNC_CONSTANTS.STATUS_CHANGED).toBeDefined();
        });

		it("should have the found constant to be equal to 'NoInfoPath::onlineStatusChanged'", function() {
            expect(NOSYNC_CONSTANTS.STATUS_CHANGED).toEqual('NoInfoPath::onlineStatusChanged');
        });

	});

	describe("Within noinfopath-sync, testing provider named noOnlineStatus", function(){

		beforeEach(inject(function(noOnlineStatusProvider){
			noOnlineStatus = noOnlineStatusProvider;
		}));

		it("should find a provider named noOnlineStatus", function (){
			expect(noOnlineStatus).toBeDefined();
		});

		it("should find a function called setEndPointUri hanging off of noOnlineStatus", function (){
		  expect(noOnlineStatus.setEndPointUri).toBeDefined();
		});

		it("should find a function called setTimeout hanging off of noOnlineStatus", function (){
		  expect(noOnlineStatus.setTimeout).toBeDefined();
		});

	});

	describe("Within noinfopath-sync, testing directive named noStatus", function(){
		
		// beforeEach(inject(function(_noOnlineStatus_){
		// 	noOnlineStatus = _noOnlineStatus_;
		// }));
		

	});

});