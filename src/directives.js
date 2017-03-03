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

				scope.$watch("sync.pending", function(n, o, s){
					if(n){
						el.find("div").addClass("pending");
					}else{
						el.find("div").removeClass("pending");
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
