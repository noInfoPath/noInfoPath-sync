//globals.js
/*
*	# noinfopath-sync
*	@version 1.0.1
*
*	## Overview
*	Provides data synchronization services.
*/
(function(angular){
	angular.module("noinfopath.sync", []);
})(angular);

//socket.js
(function(angular, io){
	"use strict";

	angular.module("noinfopath.sync")
		.service("noSync", ["$injector", "$timeout", "$q", "$rootScope", "noLocalStorage", "noConfig", "noLogService", "noLoginService", "noTransactionCache", function($injector, $timeout, $q, $rootScope, noLocalStorage, noConfig, noLogService, noLoginService, noTransactionCache){
			var noSync_lastSyncVersion = "noSync_lastSyncVersion",
				noSync_getRemoteChanges = "remoteChanges",
				noSync_sendLocalChanges = "localChanges",
				noSync_newChangesAvailable = "newChangesAvailable",
				cancelTimer, tovi = 0, oneSecond = 1000, db, socket;

			function lastSyncVersion() {
				var v = noLocalStorage.getItem(noSync_lastSyncVersion);

				return v ? v.version : 0;
			}

			function timeOutValue(reset){
				var tovs = [5, 25, 125, 25];

				if(reset || tovi >= tovs.length) tovi = 0;

				return tovs[tovi++] * oneSecond;
			}

			function stopMonitoring(){
				if(cancelTimer){
					$timeout.cancel(cancelTimer);
				}
			}

			function importChanges(syncData){
				return $q(function(resolve, reject){

					var ci = 0, ver = lastSyncVersion();

					function recurse(){
						var change = syncData.changes[ci++],
							table;

						if(change){
							if(change.version > ver) {
								noLogService.info("Importing: ", change);
								table = db[change.tableName];
								table.noUpsert(change.values)
									.then(recurse)
									.catch(function(err){
										noLogService.error(err);
										recurse();
									});
							}else{
								recurse();
							}
						}else{
							noLocalStorage.setItem(noSync_lastSyncVersion, {version: syncData.version});
							resolve();
						}
					}

					recurse();
				});
			}

			function checkForRemoteChanges(){
				noLogService.info("Checking for remote changes");
				return $q(function(resolve, reject){
					var req = {
						user: noLoginService.user.userId,
						lastSyncVersion: lastSyncVersion()
					};

					socket.emit(noSync_getRemoteChanges, req, function(syncData){
						noLogService.log(syncData);
						importChanges(syncData)
							.then(resolve)
							.catch(reject);
					});
				});
			}

			function digestLocalChanges(){
				return $q(function(resolve, reject){
					var d = 0, data = [];

					function recurse(){
						var datum = data[d++];

						socket.emit(noSync_sendLocalChanges, datum, function(resp){
							noLogService.log(resp);
							noTransactionCache.markTransactionSynced(datum)
								.then(function(result){
									if(d < data.length)
									{
										recurse();
									} else {
										resolve();
									}
								})
								.catch(function(err){
									noLogService.error(err);
								});
						});

					}

					noTransactionCache.getAllPending()
						.then(function(resp){
							data = resp;

							$rootScope.sync.inProgress = data.length;

							if($rootScope.sync.inProgress){
								noLogService.info("Local changes detected.");
								recurse();
							}else{
								noTransactionCache.dropAllSynced();
								resolve();
							}

						})
						.catch(function(err){
							$rootScope.sync.inProgress = false;
							noLogService.error(err);
						});

				});


			}

			function monitorLocalChanges(){
				noLogService.info("Monitoring local changes.");
				cancelTimer = $timeout(runChecks, timeOutValue());

			}

			function runChecks(){
				checkForRemoteChanges()
					.then(digestLocalChanges)
					.then(monitorLocalChanges)
					.catch(function(err){
						noLogService.error(err);
					});
			}

			function stateChanged(n) {
				var fns = {
						"connected": function(){
							runChecks();
						},
						"disconnected": function(){
							stopMonitoring();
						},
						"connecting": function(){

						},
						"undefined": angular.noop
					},
					fn = fns[n];

				fn();

			}

			this.configure = function(){
				var config = noConfig.current.noSync,
					dsConfig = config.noDataSource,
					provider = $injector.get(dsConfig.dataProvider);

				db = provider.getDatabase(dsConfig.databaseName);

				socket = io(config.url);

				//Map socket.io events to Angular events
				socket.on("connect", function(){
					$rootScope.sync = {state: "connected"};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on("connect_error", function(err){
					$rootScope.sync = {state: "disconnected", error: err};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on("connect_timeout", function(err){
					$rootScope.sync = {state: "disconnected"};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on("reconnect", function(count){
					$rootScope.sync = {state: "connecting", attempts: count};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on("reconnect_attempt", function(){
					$rootScope.sync = {state: "connecting"};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on("reconnecting", function(count){
					$rootScope.sync = {state: "connecting", attempts: count};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on("reconnect_error", function(err){
					$rootScope.sync = {state: "disconnected", error: err};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on("reconnect_failed", function(count){
					$rootScope.sync = {state: "disconnected"};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				$rootScope.$watch("sync.state", stateChanged);

				return $q.when(true);
			};

		}])
	;
})(angular, io);

//directives.js
(function(angular){
	angular.module("noinfopath.sync")
		.directive("noSyncStatus", [function(){
			function _link(scope, el, attrs){
				scope.$watch("sync.inProgress", function(n, o, s){
					if(n){
						el.find("div").addClass("syncing");
					}else{
						el.find("div").removeClass("syncing");
					}
				});

			}

			return {
				link: _link,
				restrict: "E",
				template: "<div class=\"no-status icon icon-connection {{sync.state}}\"></div>"
			};
		}])
	;
})(angular);
