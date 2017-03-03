//socket.js
(function (angular, io) {
	"use strict";

	function NoSyncService($injector, $timeout, $q, $rootScope, noLocalStorage, noConfig, noLoginService, noTransactionCache, _, noLocalFileStorage, noHTTP, noPrompt) {
		var noSync_lastSyncVersion = "noSync_lastSyncVersion",
			noSync_getRemoteChanges = "remoteChanges",
			noSync_sendLocalChanges = "localChanges",
			noSync_newChangesAvailable = "newChangesAvailable",
			noSync_dataReceived = "noSync::dataReceived",
			noSync_localDataUpdated = "noTransactionCache::localDataUpdated",
			db, socket;

		function monitorLocalChanges() {
			console.info("Monitoring local changes.");
			$rootScope.$on(noSync_localDataUpdated, runChecks);
		}

		//NOTE: This might not be needed other than for debugging.
		function stopMonitoringLocalChanges() {
			if ($rootScope.sync.state === "connected") {
				console.log("Stopping local change monitor.");
			}
		}

		function importChanges(syncData) {
			return $q(function (resolve, reject) {

				var ci = 0,
					changes = _.sortBy(syncData.changes, "version"),
					stats = {
						total: syncData.changes.length,
						skipped: 0,
						synced: 0
					};

				function notify(data) {
					if (data.isSame) {
						stats.skipped += 1;
					} else {
						stats.synced += 1;
						$rootScope.$broadcast(noSync_dataReceived, data);
					}
				}

				function handleFileImport(table, change) {

					if (table.noInfoPath.NoInfoPath_FileUploadCache) {
						var localFiles = $rootScope.noIndexedDb_NoInfoPath_dtc_v1.NoInfoPath_FileUploadCache;

						if (change.values.FileID) {

							return localFiles.hasPrimaryKeys([change.values.FileID])
								.then(function (keys) {
									if (keys.length > 0) {
										//file exists. just return true.
										return true;
									} else {
										var remoteFiles = noHTTP.NoInfoPath_FileUploadCache;

										//file does not exist, so request it.
										return remoteFiles.noOne(change.values.FileID)
											.then(function (fileObj) {
												console.log("Importing file", fileObj.name);
												noLocalFileStorage.cache(fileObj); //There should be only one!
											})
											.catch(function (err) {
												console.error("handleFileImport", err);
											});
									}
								});
						} else {
							return $q.when(change);
						}
					} else {
						return change;
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
						if (change.version >= $rootScope.sync.current.version) {
							table = db[change.tableName];

							if (!table) {
								recurse();
								return;
							}

							console.info("Syncing table", change.tableName);

							table.noImport(change)
								.then(handleFileImport.bind(null, table, change))
								.then(notify.bind(null, change))
								.then(recurse)
								.catch(function (err) {
									console.error("Import Error", err, change.tableName);
									recurse();
								});
						} else {
							stats.skipped += 1;
							recurse();
						}
					} else {
						console.log("Sync complete.\nTotal Changes Process:", stats.total, "\nChanges Skipped:", stats.skipped, "\nChanges Imported:", stats.synced);

						updateSyncStatus(syncData.version);

						resolve();
					}
				}

				recurse();
			});
		}

		function updateSyncStatus(version) {
			//if(version) $rootScope.sync.update("version", version);
			$rootScope.sync.current = version;
			noLocalStorage.setItem(noSync_lastSyncVersion, $rootScope.sync.toJSON());
		}
		this.updateSyncStatus = updateSyncStatus;

		function isGoodNamespace(ns) {
			var t = $rootScope.noDbSchema_names.find(function (element) {
				return ("noDbSchema_" + ns) === element;
			});

			return !!t;
		}

		function askForChanges(version) {

			var deferred = $q.defer();

			$rootScope.sync.start();

			console.info("New data changes are available...");

			var req = {
				jwt: noLoginService.user.access_token,
				lastSyncVersion: $rootScope.sync.current.version, //- 1,
				namespace: version.namespace
			};

			socket.emit(noSync_getRemoteChanges, req, function (syncData) {
				//console.log("syncData", syncData);
				if (syncData) {
					console.log("Data received: \n# of changes: " + syncData.changes.length);

					importChanges(syncData)
						.then(deferred.resolve)
						.catch(deferred.reject);
				} else {
					console.warn("syncData was null");
					deferred.resolve("warning: syncData was null");
				}
			});

			return deferred.promise;
		}
		this.askForChanges = askForChanges;

		function monitorRemoteChanges(version) {
			$rootScope.sync.current = version;

			if (!$rootScope.sync.inProgress) {

				_startImport(version);
			}
		}

		function _startImport(version) {
			if (isGoodNamespace(version.namespace)) {

				if ($rootScope.sync.needChanges) {
					console.info("Version update available for " + version.namespace + ": Local version: " + $rootScope.sync.previous.version + ", Remote version: " + version.version);

					askForChanges(version)
						.then(function () {
							console.log("Lastest changes have been imported.");
						})
						.catch(function (err) {
							$rootScope.sync.update("error", err);
							console.error(err);
						})
						.finally(function () {
							//var ts = moment();
							$rootScope.sync.syncComplete();
							$rootScope.$broadcast("sync::change", $rootScope.sync);
						});
				}
			}

		}

		function digestLocalChanges() {
			return $q(function (resolve, reject) {
				var d = 0,
					data = [],
					syncError = false;

				function recurse() {
					var datum = data[d++];
					datum.jwt = noLoginService.user.access_token;
					socket.emit(noSync_sendLocalChanges, datum, function (resp) {
						//noLogService.log(resp);
						if (resp.status === -1) {
							$rootScope.sync.inProgress = false;
							$rootScope.sync.error = resp.message;
							$rootScope.sync.state = "connecting";
							//$timeout(runChecks, 5 * 60 * 1000);
							reject({
								message: "digestLocalChanges error, will retry every 5 minutes until successful.",
								error: resp
							});
						} else {
							noTransactionCache.markTransactionSynced(datum)
								.then(function (result) {
									if (d < data.length) {
										recurse();
									} else {
										noTransactionCache.dropAllSynced()
											.then(resolve)
											.catch(reject);
											//.finally(updateSyncStatus);

									}
								})
								.catch(function (err) {
									console.error(err);
								});
						}
					});

				}

				noTransactionCache.getAllPending()
					.then(function (resp) {
						data = resp;
						console.log("Local changes: " + (!!resp ? resp.length : 0));

						$rootScope.sync.inProgress = data.length;

						if ($rootScope.sync.inProgress) {
							recurse();
						} else {
							resolve();
						}

					})
					.catch(function (err) {
						console.error(err);
					});

			});
		}

		function runChecks() {
			stopMonitoringLocalChanges();

			digestLocalChanges()
				.then(function () {
					console.log("Changes digested");

				})
				.catch(function (err) {
					console.error(err.message, err.error);
				})
				.finally(monitorLocalChanges);
		}

		function stateChanged(n) {
			var fns = {
					"connected": function () {
						runChecks();
					},
					"disconnected": function () {
						stopMonitoringLocalChanges();
					},
					"connecting": function () {

					},
					"undefined": angular.noop
				},
				fn = fns[n];

			fn();
		}

		this.configure = function () {
			var config = noConfig.current.noSync,
				dsConfig = config.noDataSource,
				provider = $injector.get(dsConfig.dataProvider);

			$rootScope.sync = noInfoPath.NoSyncData.fromJSON(noLocalStorage.getItem(noSync_lastSyncVersion));

			db = provider.getDatabase(dsConfig.databaseName);

			socket = io(config.url, {
				extraHeaders: {
					Authorization: "Bearer " + noLoginService.user.access_token
				}
			});

			//Map socket.io events to Angular events
			socket.on("connect", function () {
				socket.emit('authenticate', {
						token: noLoginService.user.access_token
					})
					.on('authenticated', function () {
						console.log("DTCS Authentication successful.");
						$rootScope.sync.update("state", "connected");
						$rootScope.$apply();
					})
					.on('unauthorized', function (msg) {
						console.log("unauthorized: " + JSON.stringify(msg.data));
						throw new Error(msg.data.type);
					});

			});

			socket.on(noSync_lastSyncVersion, monitorRemoteChanges);

			socket.on("connect_error", function (err) {
				$rootScope.sync.update("state", "disconnected");
				$rootScope.sync.update("error", err);
				$rootScope.$apply();
			});

			socket.on("connect_timeout", function (err) {
				$rootScope.sync.update("state", "disconnected");
				$rootScope.$apply();
			});

			socket.on("reconnect", function (count) {
				$rootScope.sync.update("state", "disconnected");
				$rootScope.sync.update("attempts", count);
				$rootScope.$apply();
			});

			socket.on("reconnect_attempt", function () {
				$rootScope.sync.update("state", "connecting");
				$rootScope.$apply();
			});

			socket.on("reconnecting", function (count) {
				$rootScope.sync.update("state", "connecting");
				$rootScope.sync.update("attempts", count);
				$rootScope.$apply();
			});

			socket.on("reconnect_error", function (err) {
				$rootScope.sync.update("state", "disconnected");
				$rootScope.sync.update("error", "err");
				$rootScope.$apply();
			});

			socket.on("reconnect_failed", function (count) {
				$rootScope.sync.update("state", "disconnected");
				$rootScope.$apply();
			});

			$rootScope.$watch("sync.state", stateChanged);

			return $q.when(true);
		};

	}

	angular.module("noinfopath.sync")
		.service("noSync", ["$injector", "$timeout", "$q", "$rootScope", "noLocalStorage", "noConfig", "noLoginService", "noTransactionCache", "lodash", "noLocalFileStorage", "noHTTP", "noPrompt", NoSyncService]);
})(angular, io);
