//globals.js
/*
*	# noinfopath-sync
*	@version 2.0.23
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

		function NoSyncService($injector, $timeout, $q, $rootScope, noLocalStorage, noConfig, noLoginService, noTransactionCache, _, noLocalFileSystem, noHTTP, noPrompt, noNotificationService, noTemplateCache, PubSub, noMimeTypes) {
			var noSync_lastSyncVersion = "noSync_lastSyncVersion",
				noSync_getRemoteChanges = "remoteChanges",
				noSync_sendLocalChanges = "localChanges",
				noSync_newChangesAvailable = "newChangesAvailable",
				noSync_dataReceived = "noSync::dataReceived",
				noSync_localDataUpdated = "noTransactionCache::localDataUpdated",
				db, socket, unbindMonitorLocalChanges, force = false;

			function monitorLocalChanges() {
				console.info("Monitoring local changes.");
				if (!unbindMonitorLocalChanges) {
					unbindMonitorLocalChanges = $rootScope.$on(noSync_localDataUpdated, runChecks);

				}
			}

			//NOTE: This might not be needed other than for debugging.
			function stopMonitoringLocalChanges() {
				//if ($rootScope.sync.state === "connected") {
				console.log("Stopping local change monitor.");
				if (unbindMonitorLocalChanges) {
					unbindMonitorLocalChanges();
					unbindMonitorLocalChanges = null;
				}
				//}
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

					function _notify(data) {
						console.log("notify", data);
						if (data.isSame) {
							stats.skipped += 1;
						} else {
							stats.synced += 1;
							//$rootScope.$broadcast(noSync_dataReceived, data);
						}
					}

					function _importFile(parentTable, change) {
						var fileObj = change.values,
							url = noConfig.current.NOREST + "/aws/bucket/" + fileObj.name,
							options = {
								method: "GET",
								headers: {
									"Content-Type": undefined
								},
								responseType: "arraybuffer"
							};

						noHTTP.noRequest(url, options)
							.then(function (resp) {
								var file = new File([resp.data], fileObj.name, {
									type: fileObj.type
								});

								file.DocumentID = fileObj.ID;

								return noLocalFileSystem.save(file);
								//console.log("File cached upstream.", schema);
							})
							.catch(function (err) {
								console.error(err);
							});

					}

					function _recurse() {
						if (!changes) {
							reject("No changes received due to server side error.");
							return;
						}

						var change = changes[ci++],
							table;

						if (change) {
							//May need to compare to previous.version not current.version
							if ((noConfig.current.debug && force) || change.version > $rootScope.sync.previous.version) {
								table = db[change.tableName];

								if (!table) {
									_recurse();
									return;
								}

								console.info("Syncing table", change.tableName);

								table.noImport(change)
									.then(_importFile.bind(null, table, change))
									.then(_notify.bind(null, change))
									.then(_recurse)
									.catch(function (err) {
										console.error("Import Error", err, change.tableName);
										_recurse();
									});
							} else {
								stats.skipped += 1;
								_recurse();
							}
						} else {
							console.log("Sync complete.\nTotal Changes Process:", stats.total, "\nChanges Skipped:", stats.skipped, "\nChanges Imported:", stats.synced);

							updateSyncStatus(syncData);
							PubSub.publish("noSync::complete", true);
							resolve();
						}
				}

				_recurse();
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
				if (syncData.changes.length > 0) {
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

	function _forceImport(namespace, version, cb) {
		force = true;
		_startImport(namespace, cb, version);
	}
	this.force = _forceImport;

	function _startImport(namespace, cb, version) {
		var sync = $rootScope.sync;

		if (_isGoodNamespace(namespace)) {

			if (sync.needChanges) {
				console.info("Version update available for", namespace, "\n", sync.toString());

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
						if (cb) {
							cb($rootScope.sync, message);
						} else {
							//$rootScope.$broadcast("sync::change", sync);
						}
					}.bind(null, sync));
			}
		} else {
			throw "noSync:importChanges requires a a valid namespace.";
		}

	}
	this.importChanges = _startImport;

	function _syncException(msg, datum, err) {
		return $q(function (resolve, reject) {
			datum.state = "exception";
			datum.exception = {
				orginalChangeID: datum.ChangeID,
				message: msg,
				error: err,
				userId: noLoginService.user.userId,
				timeStamp: new Date()
			};

			datum.ChangeID = noInfoPath.createUUID();

			if (noConfig.current.debug) console.error("Exception has been logged", datum);

			socket.emit(noSync_sendLocalChanges, datum, function (resp) {
				noTransactionCache.logException(datum)
					.then(resolve)
					.catch(reject);
			});
		});


	}

	function digestLocalChanges() {
		return $q(function (resolve, reject) {
			var d = 0,
				data = [],
				syncError = false;

			function _addFile(change, schema) {
				return noLocalFileSystem.getFile(change.data, schema)
					.then(function (fileObj, fileKeyName, file) {
						var payload = new FormData(),
							url = noConfig.current.NOREST + "/aws/bucket",
							options = {
								method: "POST",
								headers: {
									"Content-Type": undefined
								},
								transformRequest: angular.identity
							};

						var x = new FileReader();

						payload.append("file", file);
						payload.append("name", fileObj.name);
						payload.append("type", fileObj.type);
						payload.append("size", fileObj.size);

						noHTTP.noRequest(url, options, payload)
							.then(function () {
								console.log("File cached upstream.", schema);
							})
							.catch(function (err) {
								console.error(err);
							});

					}.bind(null, change.data, schema.primaryKey))
					.catch(function (err) {
						console.error(err);
					});

			}

			function _deleteFile(change, schema) {
				return noLocalFileSystem.deleteFile(change.data, schema);
			}

			function _processOutboundFile(change, schema) {
				//1. Get the file data using $http
				switch (change.changeType) {
				case "C":
					return _addFile(change, schema);

					// case "U":
					// 	return _deleteFile(change, schema)
					// 		.then(_addFile.bind(null, change, schema));

				case "D":
					return _deleteFile(change, schema);

				}

			}

			function _processOutboundFiles(datum) {
				//Check the changes for entities that relate to files.
				var schema = noInfoPath.getItem($rootScope, "noDbSchema_" + datum.namespace),
					promises = [];

				if (!schema) throw new Error("Invalid namespace provided in NoTransaction object.");

				datum.changes.forEach(function (change) {
					//Skip "NoInfoPath_FileUploadCache" transactions.
					console.warn("TODO: Need find were NoInfoPath_FileUploadCache is recording transactions, remove that functionality.");
					if (change.tableName !== "NoInfoPath_FileUploadCache") {
						var entity = schema.entity(change.tableName);

						if (!entity) throw new Error("Invalid table name: " + change.tableName);

						if (entity.NoInfoPath_FileUploadCache) {
							promises.push(_processOutboundFile(change, entity)
								.catch(_syncException.bind(null, "An error occur processing inbound client-side changes", datum)));
						}
					}
				});

				return !!promises.length ? $q.all(promises).then(function () {
					console.log(datum);
					return datum;
				}) : $q.when(datum);
			}

			function _sendChanges(datum) {
				return $q(function (resolve, reject) {
					socket.emit(noSync_sendLocalChanges, datum, function (resp) {
						//noLogService.log(resp);
						if (resp.status === -1) {
							console.warn("TODO: Revisit noSync_sendLocalChanges response of -1");
							$rootScope.sync.inProgress = false;
							// $rootScope.sync.error = resp.message;
							// $rootScope.sync.state = "connecting";
							//$timeout(runChecks, 5 * 60 * 1000);
							reject({
								message: "digestLocalChanges error, will retry every 5 minutes until successful.",
								error: resp
							});
						} else {
							noTransactionCache.markTransactionSynced(datum)
								.then(resolve)
								.catch(reject);
						}
					});

				});

			}

			function recurse() {
				var datum = data[d++];

				if (datum) {
					datum.jwt = noLoginService.user.access_token;
					_processOutboundFiles(datum)
						.then(_sendChanges.bind(null, datum))
						.catch(function (err) {
							_syncException("An error occur processing inbound client-side changes", datum, err)
								.then(_sendChanges.bind(null, datum));
						})
						.finally(recurse);

				} else {
					$rootScope.sync.inProgress = false;
					resolve();
				}

			}

			noTransactionCache.getAllPending()
				.then(function (resp) {
					data = resp;
					console.log("Local changes: " + (!!resp ? resp.length : 0));

					$rootScope.sync.inProgress = !!data.length;

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


		$rootScope.$watch("sync.state", stateChanged);

		return $q.when(true);
	};

	this.connect = function () {
		var config = noConfig.current.noSync,
			initialLoad = true;

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
					if (!initialLoad) noNotificationService.appendMessage("Connection to Data Transaction Coordinator Service successful.", {
						id: "connected",
						type: "success"
					});
					initialLoad = false;
					$rootScope.sync.update("state", "connected");
					$rootScope.$apply();
				})
				.on('unauthorized', function (msg) {
					noNotificationService.appendMessage("Failed to authenticate with Data Transaction Coordinator Service.", {
						id: "unauthorized",
						type: "warning"
					});
					console.log("unauthorized: " + JSON.stringify(msg.data));
					throw new Error(msg.data.type);
				});

		});

		socket.on(noSync_lastSyncVersion, monitorRemoteChanges);

		socket.on("connect_error", function (err) {
			if (!initialLoad) noNotificationService.appendMessage("Lost connection to Data Transaction Coordinator Service.", {
				id: "disconnected",
				type: "danger",
				ttl: "2"
			});
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

		return $q.when(true);

	};
}


angular.module("noinfopath.sync")
	.service("noSync", ["$injector", "$timeout", "$q", "$rootScope", "noLocalStorage", "noConfig", "noLoginService", "noTransactionCache", "lodash", "noLocalFileSystem", "noHTTP", "noPrompt", "noNotificationService", "noTemplateCache", "PubSub", "noMimeTypes", NoSyncService]);
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
