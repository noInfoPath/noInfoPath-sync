//globals.js
/*
*	# noinfopath-sync
*	@version 2.0.21
*
*	## Overview
*	Provides data synchronization services.
*/
(function(angular){
	/*
	*	## @class NoSyncData
	*
	*	TODO: Add description.
	*/
	function NoSyncData(data) {

		//Defaults
		this.attempts = 0;
		this.error  = "";
		//this.inProgress = false;
		this.state = "connecting";

		var _initializing = true;
		this.initialized= function() {
			_initializing = false;
		};

		var _inProgress = false;
		Object.defineProperty(this, "inProgress", {
			get: function(){
				return _inProgress;
			},
			set: function(v) {
				_inProgress = v;
			}
		});

		/*
		*	#### String lastSync (read only)
		*
		*	##### getter
		*	Returns the amount of time that has past since the last sync event.
		*/
		Object.defineProperty(this, "lastSync", {
			get: function(){
				var t = moment(this.lastSyncTimestamp).fromNow();
				return t === "Invalid date" ? "never" : t;
			}
		});

		/*
		*	#### Boolean needChanges (read only)
		*
		*	##### getter
		*	Return true if the `previousVersion` is greater than zero, and `version`
		*	is greater than `previousVersion`.
		*/
		Object.defineProperty(this, "needChanges", {
			get: function(){
				return _initializing ||  (this.previous.version > 0 && this.previous.version < this.previous.version);
			}
		});

		var _internalDate = new Date();
		Object.defineProperty(this, "lastSyncTimestamp", {
			get: function(){
				return _internalDate;
			},
			set: function(v) {
				if(angular.isString(v)) {
					_internalDate = new Date(v);
				} else if(angular.isDate(v)) {
					_internalDate = v;
				}
			}
		});

		/*
		*	#### Obect previousVersion (read only)
		*
		*	##### getter
		*	Return the pervious version update information, if any.
		*	Otherwise returns `null`
		*/
		var _prevVersion = {version: 0};
		Object.defineProperty(this, "previous", {
			get: function(){

				return _prevVersion;
			}
		});

		/*
		*	#### Object version (read/write)
		*
		*	##### getter
		*	returns the current version object used for requesting data from DTCS.
		*
		*	##### setter
		*	Set the `previousVersion` to the current `version`, then sets
		*	current 'version' to the assignment value.  Finally, sets the
		*	`pending` property to true.
		*
		*/
		var _version = {version: 0};
		Object.defineProperty(this, "current", {
			get: function(){
				return _version;
			},
			set: function(v) {

				_prevVersion = _version;
				_version = v || _version;
				_pending = true;
				_inProgress = false;
				_internalDate = new Date();
			}
		});

		/*
		*	#### Boolean (read/write)
		*
		*	##### getter
		*	Returns the current pending state.
		*
		*/
		var _pending = false;
		Object.defineProperty(this, "pending", {
			get: function(){
				return _pending;
			}
		});

		/*
		*	#### clearPending()
		*
		*	Set the pending state to false.
		*/
		this.clearPending = function() {
			_pending = false;
		};

		this.finished = function(){
			_pending = false;
			_inProgress = false;
			_internalDate = new Date();
			_prevVersion = _version;
		};

		this.start = function() {
			_inProgress = true;
		};

		//Merge with data
		if(data) {
			//this.lastSyncTimestamp = data.lastSyncTimestamp || this.lastSyncTimestamp;
			this.current = data.version;
		}

		/*
		*	#### String toJSON()
		*
		*	Return a pure javascript object suitable for persistence in localStorage.
		*/
		this.toJSON = function() {
			var ds = Object.getOwnPropertyDescriptors(this),
				o = {},
				blacklist = ["attempts", "error", "inProgress", "state", "lastSync"];
			for(var k in ds) {
				var d = ds[k],
					t = this[k],
					f = angular.isFunction(t);


				if(!f && blacklist.indexOf(k) === -1) {
					o[k] = t;
				}
			}
			return JSON.stringify(o);
		};

		this.update = function(key, value) {
			this[key] = value;
		};


	}


	/*
	*	#### Static NoSyncData fromJSON(data)
	*
	*	Returns a new NoSyncData intances hydrated with the provide pure javascript object.
	*/
	NoSyncData.fromJSON = function(data) {
		var tmp = angular.isString(data) ? JSON.parse(data) : data;
			obj = new NoSyncData(tmp);

		return obj;
	};

	NoSyncData.prototype.toString = function() {
		var ret = "Sync Status\n-----------------------" + "\nCurrent Version: " + this.current.version + "\nPrevious Version: " + this.previous.version +  "\nState: " + this.state + "\nNeedChanges: " + this.needChanges + "\nPending: " + this.pending + "\nIn Progress: " + this.inProgress;

		return ret;
	};
	noInfoPath.NoSyncData = NoSyncData;

	angular.module("noinfopath.sync", []);
})(angular);

//socket.js
(function (angular, io) {
	"use strict";

	function NoSyncService($injector, $timeout, $q, $rootScope, noLocalStorage, noConfig, noLoginService, noTransactionCache, _, noLocalFileStorage, noHTTP, noPrompt, noNotificationService, noTemplateCache) {
		var noSync_lastSyncVersion = "noSync_lastSyncVersion",
			noSync_getRemoteChanges = "remoteChanges",
			noSync_sendLocalChanges = "localChanges",
			noSync_newChangesAvailable = "newChangesAvailable",
			noSync_dataReceived = "noSync::dataReceived",
			noSync_localDataUpdated = "noTransactionCache::localDataUpdated",
			db, socket, unbindMonitorLocalChanges, force = false;

		function monitorLocalChanges() {
			console.info("Monitoring local changes.");
			unbindMonitorLocalChanges = $rootScope.$on(noSync_localDataUpdated, runChecks);
		}

		//NOTE: This might not be needed other than for debugging.
		function stopMonitoringLocalChanges() {
			if ($rootScope.sync.state === "connected") {
				console.log("Stopping local change monitor.");
				if(unbindMonitorLocalChanges) unbindMonitorLocalChanges();
			}
		}

		function _importChanges(syncData) {
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
						if ((noConfig.current.debug && force) || change.version >= $rootScope.sync.current.version) {
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

						updateSyncStatus(syncData);

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

		function _isGoodNamespace(ns) {
			var t = $rootScope.noDbSchema_names.find(function (element) {
				console.log(element);
				return ("noDbSchema_" + ns) === element;
			});

			return !!t;
		}

		function _askForChanges(version, namespace) {

			var deferred = $q.defer();



			var req = {
				jwt: noLoginService.user.access_token,
				lastSyncVersion: version, //- 1,
				namespace: namespace
			};

			socket.emit(noSync_getRemoteChanges, req, function (syncData) {
				//console.log("syncData", syncData);
				if (syncData) {
					if(syncData.changes.length > 0) {
						console.info("New data changes are available...");
						$rootScope.sync.start();
						_importChanges(syncData)
							.then(deferred.resolve)
							.catch(deferred.reject);
					} else {
						deferred.resolve("No changes to import");
					}
				} else {
					console.warn("syncData was null");
					deferred.resolve("warning: syncData was null");
				}
			});

			return deferred.promise;
		}

		function monitorRemoteChanges(version) {
			$rootScope.sync.current = version;

			// if (!$rootScope.sync.inProgress && $rootScope.sync.needChanges) {
			// 	noTemplateCache.get("templates/sync-notification.tpl.html")
			// 		.then(function(tmpl){
			// 			noNotificationService.appendMessage(tmpl, {id: "changes-available", dismissible: true, type: "warning"});
			// 		});
			//
			// 	//_startImport(version);
			// }
		}

		function _forceImport(namespace, version, cb){
			force = true;
			_startImport(namespace, cb, version);
		}
		this.force = _forceImport;

		function _startImport(namespace, cb, version) {
			var sync = $rootScope.sync;

			if (_isGoodNamespace(namespace)) {

				if (sync.needChanges) {
					console.info("Version update available for\n", namespace, sync.toString());

					_askForChanges(version || sync.previous.version, namespace)
						.then(function (msg) {
							console.log(msg || "Lastest changes have been imported.");
							return msg;
						})
						.catch(function (err) {
							sync.update("error", err);
							console.error(err);
						})
						.finally(function (sync, message) {
							force = false;
							//var ts = moment();
							sync.finished();
							console.log("Sync Complete\n", sync.toString());
							$rootScope.$broadcast("sync::change", sync);
							if(cb) {
								cb($rootScope.sync, message);
							}
						}.bind(null, sync));
				}
			} else {
				throw "noSync:importChanges requires a a valid namespace.";
			}

		}
		this.importChanges = _startImport;


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
				provider = $injector.get(dsConfig.dataProvider),
				initialLoad = true;

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
						if(!initialLoad) noNotificationService.appendMessage("Connection to Data Transaction Coordinator Service successful.", {type: "success"});
						initialLoad = false;
						$rootScope.sync.update("state", "connected");
						$rootScope.$apply();
					})
					.on('unauthorized', function (msg) {
						noNotificationService.appendMessage("Failed to authenticate with Data Transaction Coordinator Service.", {type: "warning"});
						console.log("unauthorized: " + JSON.stringify(msg.data));
						throw new Error(msg.data.type);
					});

			});

			socket.on(noSync_lastSyncVersion, monitorRemoteChanges);

			socket.on("connect_error", function (err) {
				if(!initialLoad) noNotificationService.appendMessage("Lost connection to Data Transaction Coordinator Service.", {type: "danger", ttl: "2"});
				initialLoad = false;
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
		.service("noSync", ["$injector", "$timeout", "$q", "$rootScope", "noLocalStorage", "noConfig", "noLoginService", "noTransactionCache", "lodash", "noLocalFileStorage", "noHTTP", "noPrompt", "noNotificationService", "noTemplateCache", NoSyncService]);
})(angular, io);

//directives.js
(function(angular){
	angular.module("noinfopath.sync")
		.directive("noSyncStatus", ["noPrompt", function(noPrompt){
			function _link(scope, el, attrs){
				var unWatch = scope.$watch("sync.inProgress", function(n, o, s){
					if(n){
						el.find("div").addClass("syncing");
					}else{
						el.find("div").removeClass("syncing");
					}
				});

				scope.$on("$destroy", unWatch);
			}

			return {
				link: _link,
				restrict: "E",
				template: "<div class=\"no-status {{sync.state}}\"><i class=\"fa fa-wifi\"></i></div>"
			};
		}])
		.directive("noAlert", ["noConfig", "noPrompt", "noTemplateCache", "noSync", function(noConfig, noPrompt,noTemplateCache, noSync){
			//<div class="no-flex horizontal flex-around flex-middle"><button class="btn btn-warning btn-xs btn-callback">Import Now</button><button class="btn btn-warning btn-xs">Maybe Later</button></div>
			function _importChanges(version) {
				noPrompt.hide();

				noPrompt.show(
					"Data Synchronization in Progress",
					"<div class=\"progress\"><div class=\"progress-bar progress-bar-info progress-bar-striped\" role=\"progressbar\" aria-valuenow=\"100\" aria-valuemin=\"100\" aria-valuemax=\"100\" style=\"width: 100%\"></div></div>"
				);

				if(version) {
					noSync.force("rmEFR2", version, function(){
						noPrompt.hide(250);
					});
				} else {
					noSync.importChanges("rmEFR2", function(){
						noPrompt.hide(250);
					});
				}
			}

			function _promptCallback(e) {
				if($(e.target).attr("value") === "immport") {
					_importChanges();
				} else {
					noPrompt.hide();
				}
			}

			function _promptCallbackDebug(scope, e) {
				if($(e.target).attr("value") === "immport") {
					_importChanges(scope.tmpVersion);
				} else {
					noPrompt.hide();
				}
			}

			function _alertIconClicked(scope, e) {
				e.preventDefault();

				if(!scope.sync.pending) {
					if(noConfig.current.debug) {
						scope.tmpVersion = scope.sync.previous.version;

						noTemplateCache.get("templates/sync-askforchanges.tpl.html")
							.then(function(tmpl){
								noPrompt.show(
									"Check for Changes",
									tmpl,
									_promptCallbackDebug.bind(null, scope),
									{
										showCloseButton: true,
										showFooter: {
											showCancel: true,
											showOK: true,
											okValue: "immport"
										},
										scope: scope,
										width: "50%",
										height: "20%",
									});
							});
					}

				} else {
					noTemplateCache.get("templates/sync-notification.tpl.html")
						.then(function(tmpl){
							noPrompt.show(
								"Data Update Available",
								tmpl,
								_promptCallback,
								{
									showCloseButton: true,
									showFooter: {
										showCancel: true,
										cancelLabel: "Not Now, Maybe Later",
										showOK: true,
										okLabel: "Import Now",
										okValue: "immport"
									},
									scope: scope,
									width: "40%",
									height: "20%",
								});
						});
				}
			}


			function _link(scope, el, attrs){
				var b = el.find("button"), unWatch;
				console.log(b);
				b.click(_alertIconClicked.bind(null, scope));

				unWatch = scope.$watch("sync.pending", function(n, o, s){
					if(n){
						el.find("button").addClass("unread");
					}else{
						el.find("button").removeClass("unread");
					}
				});

				scope.$on("$destroy", unWatch);
			}


			return {
				compile: function(el, attrs) {
					return _link;
				},
				restrict: "E",
				template: "<div><button type=\"button\"><i class=\"fa fa-bell\" aria-hidden=\"true\"></i></button></div>"
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
					//sync.lastSync = sync.lastSync.fromNow ? sync.lastSync : moment(sync.lastSync);
					$rootScope.sync.lastSync = sync.lastSync;
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
				template: "<div class='no-last-sync'>Last synced {{sync.lastSync}} @ Version {{  sync.pending ? sync.previous.version : sync.current.version }}</div>"
			};
		}])
	;
})(angular);
