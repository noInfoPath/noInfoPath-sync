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
