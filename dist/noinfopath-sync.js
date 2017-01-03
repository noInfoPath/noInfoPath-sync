//globals.js
/*
*	# noinfopath-sync
*	@version 2.0.10
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

			return v && v.version ? v.version : 0;
		}
		this.lastSyncVersion = lastSyncVersion;

		function timeOutValue(reset) {
			var tovs = [5, 25, 10, 25];

			if (reset || tovi >= tovs.length) tovi = 0;

			return tovs[tovi++] * oneSecond;
		}

		function monitorLocalChanges() {
			console.info("Monitoring local changes.");
			//cancelTimer = $timeout(runChecks, timeOutValue());

			cancelTimer = $rootScope.$on("noTransactionCache::localDataUpdated", runChecks);
		}

		function stopMonitoringLocalChanges() {
			if (cancelTimer) {
				noLogService.log("stopping local change monitor.");
				//$timeout.cancel(cancelTimer);
				cancelTimer();
			}
		}

		function importChanges(syncData) {
			return $q(function(resolve, reject) {

				var ci = 0,
				ver = lastSyncVersion(),
				changes = _.sortBy(syncData.changes, "version");

				function notify(data) {
					if (!data.isSame) {
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
							table = db[change.tableName];

							if(!table) {
								recurse();
								return;
							}

							console.info("Importing: " + JSON.stringify(change));

							table.noImport(change)
								.then(notify.bind(null, change))
								.then(recurse)
								.catch(function(err) {
									console.error("Import Error", err, change.tableName);
									recurse();
							});
						} else {
							recurse();
						}
					} else {
						updateSyncStatus(syncData.version);

						resolve();
					}
				}

				recurse();
			});
		}

		function updateSyncStatus(version) {
			if(version) $rootScope.sync.version = version;
			$rootScope.sync.inProgress = false;
			$rootScope.sync.lastSync = moment();
			noLocalStorage.setItem(noSync_lastSyncVersion, $rootScope.sync);
		}

		function isGoodNamespace(ns) {
			var t = $rootScope.noDbSchema_names.find(function(element) {
				return ("noDbSchema_" + ns) === element;
			});

			return !!t;
		}

		function askForChanges(version) {

			var deferred = $q.defer(),
			lv = lastSyncVersion();

			$rootScope.sync.inProgress = true;
			noLogService.info("New data changes are available...");

			var req = {
				jwt: noLoginService.user.access_token,
				lastSyncVersion: lv, //- 1,
				namespace: version.namespace
			};

			socket.emit(noSync_getRemoteChanges, req, function(syncData) {
				console.log("syncData", syncData);
				noLogService.log("Data received: \n# of changes: " + syncData.changes.length);
				importChanges(syncData)
					.then(deferred.resolve)
					.then(deferred.reject);
			});

			return deferred.promise;
		}
		this.askForChanges = askForChanges;

		function monitorRemoteChanges(version) {
			console.log("monitorRemoteChanges", version);
			if (!$rootScope.sync.inProgress) {
				if (isGoodNamespace(version.namespace)) {
					var lv = lastSyncVersion();
					noLogService.info("Version Check for " + version.namespace + ": Local version: " + lv + ", Remote version: " + version.version);
					if (lv < version.version) {
						askForChanges(version)
							.then(function() {
								console.log("Lastest changes have been imported.");
							})
							.catch(function(err) {
								console.error(err);
							})
							.finally(function() {
								var ts = moment();
								$rootScope.sync.inProgress = false;
								noLocalStorage.setItem(noSync_lastSyncVersion, {
									version: version.version,
									lastSync: ts
								});
							});
					}
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
					datum.jwt = noLoginService.user.access_token;
					socket.emit(noSync_sendLocalChanges, datum, function(resp) {
						//noLogService.log(resp);
						if (resp.status === -1) {
							$rootScope.sync.inProgress = false;
							$rootScope.sync.error = resp.message;
							$rootScope.sync.state = "connecting";
							$timeout(runChecks, 5 * 60 * 1000);
							reject({message: "digestLocalChanges error, will retry every 5 minutes until successful.", error: resp});
						} else {
							noTransactionCache.markTransactionSynced(datum)
								.then(function(result) {
									if (d < data.length) {
										recurse();
									} else {
										noTransactionCache.dropAllSynced()
											.then(resolve)
											.catch(reject)
											.finally(function() {
												updateSyncStatus();
											});

									}
								})
								.catch(function(err) {
									console.error(err);
								});
						}
					});

				}

				noTransactionCache.getAllPending()
					.then(function(resp) {
						data = resp;
						console.log("Local changes: " + (!!resp ? resp.length : 0));

						$rootScope.sync.inProgress = data.length;

						if ($rootScope.sync.inProgress) {
							recurse();
						} else {
							resolve();
						}

					})
					.catch(function(err) {
						console.error(err);
					});

			});
		}

		function runChecks() {
			stopMonitoringLocalChanges();

			digestLocalChanges()
				.then(function() {
					console.log("Changes digested");

				})
				.catch(function(err) {
					console.error(err.message, err.error);
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

			if(!angular.isObject($rootScope.sync)){
				$rootScope.sync = {};
			}

			db = provider.getDatabase(dsConfig.databaseName);

			socket = io(config.url, {
				extraHeaders: {
					Authorization: "Bearer " + noLoginService.user.access_token
				}
			});

			//Map socket.io events to Angular events
			socket.on("connect", function() {
				socket.emit('authenticate', {
					token: noLoginService.user.access_token
				})
				.on('authenticated', function() {
					$rootScope.sync.state = "connected";
					$rootScope.$broadcast("sync::change", $rootScope.sync);
					$rootScope.$apply();
				})
				.on('unauthorized', function(msg) {
					console.log("unauthorized: " + JSON.stringify(msg.data));
					throw new Error(msg.data.type);
				});

			});

			socket.on(noSync_lastSyncVersion, monitorRemoteChanges);

			socket.on("connect_error", function(err) {
				$rootScope.sync.state =  "disconnected";
				$rootScope.sync.error = err;

				$rootScope.$broadcast("sync::change", $rootScope.sync);
				$rootScope.$apply();
			});

			socket.on("connect_timeout", function(err) {
				$rootScope.sync.state = "disconnected";

				$rootScope.$broadcast("sync::change", $rootScope.sync);
				$rootScope.$apply();
			});

			socket.on("reconnect", function(count) {
				$rootScope.sync.state = "connecting";
				$rootScope.sync.attempts = count;
				$rootScope.$broadcast("sync::change", $rootScope.sync);
				$rootScope.$apply();
			});

			socket.on("reconnect_attempt", function() {
				$rootScope.sync.state = "connecting";
				$rootScope.$broadcast("sync::change", $rootScope.sync);
				$rootScope.$apply();
			});

			socket.on("reconnecting", function(count) {
				$rootScope.sync.state = "connecting";
				$rootScope.sync.attempts = count;
				$rootScope.$broadcast("sync::change", $rootScope.sync);
				$rootScope.$apply();
			});

			socket.on("reconnect_error", function(err) {
				$rootScope.sync.state = "disconnected";
				$rootScope.sync.error = err;
				$rootScope.$broadcast("sync::change", $rootScope.sync);
				$rootScope.$apply();
			});

			socket.on("reconnect_failed", function(count) {
				$rootScope.sync.state = "disconnected";
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
				template: "<div class=\"no-status {{sync.state}}\"><i class=\"fa fa-wifi\"></i></div>"
			};
		}])

		.directive("noLastSync", ["$interval", "$rootScope", "noLocalStorage", function($interval, $rootScope, noLocalStorage){
			function updateSyncStatus() {
				var noSync_lastSyncVersion = "noSync_lastSyncVersion",
					sync = noLocalStorage.getItem(noSync_lastSyncVersion);

				if(!angular.isObject($rootScope.sync)){
					$rootScope.sync = {};
				}

				if(sync && sync.lastSync){
					sync.lastSync = sync.lastSync.fromNow ? sync.lastSync : moment(sync.lastSync);
					$rootScope.sync.lastSync = sync.lastSync.fromNow();
				} else {
					$rootScope.sync.lastSync = "never";
				}
			}

			function _link(scope, el, attrs){
				updateSyncStatus();
				$interval(updateSyncStatus, 1000);
			}

			return {
				link: _link,
				restrict: "E",
				template: "<div class='no-last-sync'>Last synced {{sync.lastSync}}</div>"
			};
		}])
	;
})(angular);
