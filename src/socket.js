//socket.js
(function (angular, io) {
		"use strict";

		function NoSyncService($injector, $timeout, $q, $rootScope, noLocalStorage, noConfig, noLoginService, noTransactionCache, _, noDataSource, noHTTP, noPrompt, noNotificationService, noTemplateCache, PubSub, noMimeTypes) {
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
						var parentSchema = parentTable.noInfoPath.parentSchema.config,
							dsConfig = {
								"dataProvider": parentSchema.provider,
								"databaseName": parentSchema.dbName,
								"entityName": parentTable.noInfoPath.entityName,
								"primaryKey": parentTable.noInfoPath.primaryKey
							},
							importDS = noDataSource.create(dsConfig, $rootScope);

						switch(change.operation){
							case "C":
								var fileObj = change.values,
									url = noConfig.current.NOREST + "/aws/bucket/" + fileObj.name,
									options = {
										method: "GET",
										headers: {
											"Content-Type": undefined
										},
										responseType: "arraybuffer"
									};

								return noHTTP.noRequest(url, options)
									.then(function (resp) {
										var file = new File([resp.data], fileObj.name, {
											type: fileObj.type
										});

										file.DocumentID = fileObj.ID;

										return importDS.createDocument(fileObj, file);
										//console.log("File cached upstream.", schema);
									})
									.catch(function (err) {
										console.error(err);
									});

							case "U":
								return importDS.update(change.values);
							case "D":
								return importDS.destroy(change.changedPKID);
						}
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
				return $q(function(resolve, reject){


				var parentTable = db[change.schema.entityName],
					parentSchema = parentTable.noInfoPath.parentSchema.config,
					dsConfig = {
						"dataProvider": parentSchema.provider,
						"databaseName": parentSchema.dbName,
						"entityName": parentTable.noInfoPath.entityName,
						"primaryKey": parentTable.noInfoPath.primaryKey
					},
					exportDS = noDataSource.create(dsConfig, $rootScope);

				exportDS.readDocument(change.data)
					.then(function (fileObj, file) {
						var payload = new FormData(),
							url = noConfig.current.NOREST + "/aws/bucket",
							options = {
								method: "POST",
								headers: {
									"Content-Type": undefined
								},
								transformRequest: angular.identity
							};

						payload.append("file", file);
						payload.append("name", fileObj.name);
						payload.append("type", fileObj.type);
						payload.append("size", fileObj.size);

						noHTTP.noRequest(url, options, payload)
							.then(function () {
								console.log("File cached upstream.", schema);
								resolve();
							})
							.catch(function (err) {
								console.error(err);
								reject(err);
							});

					}.bind(null, change.data))
					.catch(function (err) {
						console.error(err);
						reject(err);
					});

				})
			}

			function _deleteFile(change, schema) {
				return $q(function(resolve, reject){

					var parentTable = db[change.schema.entityName],
						parentSchema = parentTable.noInfoPath.parentSchema.config,
						dsConfig = {
							"dataProvider": parentSchema.provider,
							"databaseName": parentSchema.dbName,
							"entityName": parentTable.noInfoPath.entityName,
							"primaryKey": parentTable.noInfoPath.primaryKey
						},
						exportDS = noDataSource.create(dsConfig, $rootScope);

					// exportDS.readDocument(change.data)
					// 	.then(function (fileObj, fileKeyName, file) {
							var payload = new FormData(),
								url = noConfig.current.NOREST + "/aws/bucket/" + change.data.name,
								options = {
									method: "DELETE"
								};

							noHTTP.noRequest(url, options)
								.then(function () {
									console.log("File deleted upstream.", schema);
									resolve();
								})
								.catch(function (err) {
									console.error(err);
									reject(err);
								});

						// }.bind(null, change.data, schema.primaryKey))
						// .catch(function (err) {
						// 	console.error(err);
						// 	reject(err);
						// });

				});
			}

			function _processOutboundFile(change, schema) {
				switch (change.changeType) {
					case "C":
						return _addFile(change, schema);
			
					case "U":
						return _deleteFile(change, schema)
							.then(_addFile.bind(null, change, schema));

					case "D":
						return _deleteFile(change, schema);
					
					}
			}

			function _processOutboundFiles(datum) {
				//Check the changes for entities that relate to files.
				var schema = noInfoPath.getItem($rootScope, "noDbSchema_" + datum.namespace),
					promises = [];

				if (!schema) throw new Error("Invalid namespace provided in NoTransaction object.");

				if(!!datum.cachedFiles.length) {
					datum.cachedFiles.forEach(function(fileChange){
						console.log("fileChange", fileChange);
						promises.push(_processOutboundFile(fileChange, fileChange.schema)
							.catch(_syncException.bind(null, "An error occur processing inbound client-side changes", datum)));
					});

					return $q.all(promises).then(function (results) {
						console.log(results);
						return datum;
					});
				} else {
					return $q.when(datum);
				}
			}

			function _sendChanges(datum) {
				return $q(function (resolve, reject) {
					socket.emit(noSync_sendLocalChanges, datum, function (resp) {
						//noLogService.log(resp);
						if (resp.status === -1) {
							_syncException(resp.message, datum, resp.originalError)
								.then(resolve)
								.catch(reject);

							//console.warn("TODO: Revisit noSync_sendLocalChanges response of -1");

							// $rootScope.sync.inProgress = false;
							// $rootScope.sync.error = resp.message;
							// $rootScope.sync.state = "connecting";
							//$timeout(runChecks, 5 * 60 * 1000);
							// reject({
							// 	message: "digestLocalChanges error, will retry every 5 minutes until successful.",
							// 	error: resp
							// });
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
					noTransactionCache.dropAllSynced()
						.then(resolve)
						.catch(reject)
						.finally(function(){
							$rootScope.sync.inProgress = false;
						});
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
	.service("noSync", ["$injector", "$timeout", "$q", "$rootScope", "noLocalStorage", "noConfig", "noLoginService", "noTransactionCache", "lodash", "noDataSource", "noHTTP", "noPrompt", "noNotificationService", "noTemplateCache", "PubSub", "noMimeTypes", NoSyncService]);
})(angular, io);
