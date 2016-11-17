//globals.js
/*
*	# noinfopath-sync
*	@version 1.0.7
*
*	## Overview
*	Provides data synchronization services.
*/
(function(angular){
	angular.module("noinfopath.sync", []);
})(angular);

//socket.js
(function(angular, io) {
	"use strict";

	angular.module("noinfopath.sync")
		.service("noSync", ["$injector", "$timeout", "$q", "$rootScope", "noLocalStorage", "noConfig", "noLogService", "noLoginService", "noTransactionCache", "lodash", function($injector, $timeout, $q, $rootScope, noLocalStorage, noConfig, noLogService, noLoginService, noTransactionCache, _) {
			var noSync_lastSyncVersion = "noSync_lastSyncVersion",
				noSync_getRemoteChanges = "remoteChanges",
				noSync_sendLocalChanges = "localChanges",
				noSync_newChangesAvailable = "newChangesAvailable",
				noSync_dataReceived = "noSync::dataReceived",
				cancelTimer, tovi = 0,
				oneSecond = 1000,
				db, socket;

			function lastSyncVersion() {
				var v = noLocalStorage.getItem(noSync_lastSyncVersion);

				return v ? v.version : 0;
			}

			function timeOutValue(reset) {
				var tovs = [5, 25, 10, 25];

				if (reset || tovi >= tovs.length) tovi = 0;

				return tovs[tovi++] * oneSecond;
			}

			function stopMonitoringLocalChanges() {
				if (cancelTimer) {
					//$timeout.cancel(cancelTimer);
					cancelTimer();
				}
			}

			function importChanges(syncData) {
				return $q(function(resolve, reject) {

					var ci = 0,
						ver = lastSyncVersion(),
						changes = _.sortBy(syncData.changes, "version");

					function notify(data){
						if(!data.isSame){
							$rootScope.$broadcast(noSync_dataReceived, data);
						}
					}

					function recurse() {
						if (!changes) {
							reject("No changes received due to server side error.");
							return;
						}

						var change = changes[ci++],
							table;

						if (change) {
							if (change.version >= ver) {
								noLogService.info("Importing: " + change);
								table = db[change.tableName];
								table.noImport(change)
									.then(notify.bind(null, change))
									.then(recurse)
									.catch(function(err) {
										noLogService.error(err);
										recurse();
									});
							} else {
								recurse();
							}
						} else {
							noLocalStorage.setItem(noSync_lastSyncVersion, {
								version: syncData.version
							});
							resolve();
						}
					}

					recurse();
				});
			}

			function monitorRemoteChanges(version) {
				var lv = lastSyncVersion();

				if (!$rootScope.sync.inProgress) {

					noLogService.info("Version Check: Local version: " + lv + ", Remote version: " + version.version);
					if (lv < version.version) {
						$rootScope.sync.inProgress = true;
						noLogService.info("New data changes are available...");

						var req = {
							user: noLoginService.user.userId,
							lastSyncVersion: lv //- 1
						};

						socket.emit(noSync_getRemoteChanges, req, function(syncData) {
							noLogService.log("Data received: \n# of changes: " + syncData.changes.length);
							importChanges(syncData)
								.then(function() {
									noLogService.log("Lastest changes have been imported.");
								})
								.catch(function(err) {
									noLogService.error(err);

								})
								.finally(function() {
									$rootScope.sync.inProgress = false;
									noLocalStorage.setItem(noSync_lastSyncVersion, {
										version: version.version
									});
								});
						});


					}
				}

			}

			function digestLocalChanges() {
				return $q(function(resolve, reject) {
					var d = 0,
						data = [],
						syncError = false;

					function recurse() {
						var datum = data[d++];

						socket.emit(noSync_sendLocalChanges, datum, function(resp) {
							//noLogService.log(resp);
							if(resp.statusCode != -1){
								noTransactionCache.markTransactionSynced(datum)
								.then(function(result) {
									if (d < data.length) {
										recurse();
									} else {
										noTransactionCache.dropAllSynced()
										.then(resolve)
										.catch(reject)
										.finally(function(){
											$rootScope.sync.inProgress = false;
										});

									}
								})
								.catch(function(err) {
									noLogService.error(err);
								});
							} else {
								if(!syncError){
									noLogService.error("DTC unable to sync changes at this time. Will attempt again in 5 minutes.");
									syncError = true;
									$timeout(function(){
										noTransactionCache.dropAllSynced()
											.then(resolve)
											.catch(reject)
											.finally(function(){
												syncError = false;
												$rootScope.sync.inProgress = false;
											});
									}, 300000);
								}
							}
						});

					}

					noTransactionCache.getAllPending()
						.then(function(resp) {
							data = resp;
							noLogService.log("Local changes: " + (!!resp ? resp.length : 0));

							$rootScope.sync.inProgress = data.length;

							if ($rootScope.sync.inProgress) {
								recurse();
							}else{
								resolve();
							}

						})
						.catch(function(err) {
							noLogService.error(err);
						});

				});


			}

			function monitorLocalChanges() {
				noLogService.info("Monitoring local changes.");
				//cancelTimer = $timeout(runChecks, timeOutValue());

				cancelTimer = $rootScope.$on("noTransactionCache::localDataUpdated", runChecks);
			}

			function runChecks() {
				stopMonitoringLocalChanges();
				digestLocalChanges()
					.then(function(){
						noLogService.log("Changes digested");
					})
					.catch(function(err) {
						noLogService.error(err);

					})
					.finally(monitorLocalChanges);
			}

			function stateChanged(n) {
				var fns = {
						"connected": function() {
							runChecks();
						},
						"disconnected": function() {
							stopMonitoringLocalChanges();
						},
						"connecting": function() {

						},
						"undefined": angular.noop
					},
					fn = fns[n];

				fn();

			}

			this.configure = function() {
				var config = noConfig.current.noSync,
					dsConfig = config.noDataSource,
					provider = $injector.get(dsConfig.dataProvider);

				db = provider.getDatabase(dsConfig.databaseName);

				socket = io(config.url);

				//Map socket.io events to Angular events
				socket.on("connect", function() {
					$rootScope.sync = {
						state: "connected"
					};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on(noSync_newChangesAvailable, monitorRemoteChanges);

				socket.on("connect_error", function(err) {
					$rootScope.sync = {
						state: "disconnected",
						error: err
					};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on("connect_timeout", function(err) {
					$rootScope.sync = {
						state: "disconnected"
					};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on("reconnect", function(count) {
					$rootScope.sync = {
						state: "connecting",
						attempts: count
					};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on("reconnect_attempt", function() {
					$rootScope.sync = {
						state: "connecting"
					};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on("reconnecting", function(count) {
					$rootScope.sync = {
						state: "connecting",
						attempts: count
					};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on("reconnect_error", function(err) {
					$rootScope.sync = {
						state: "disconnected",
						error: err
					};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				socket.on("reconnect_failed", function(count) {
					$rootScope.sync = {
						state: "disconnected"
					};
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				});

				$rootScope.$watch("sync.state", stateChanged);

				return $q.when(true);
			};

		}]);
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
