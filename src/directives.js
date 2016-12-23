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
			function _link(scope, el, attrs){
				var noSync_lastSyncVersion = "noSync_lastSyncVersion",
					lastTimestamp = noLocalStorage.getItem(noSync_lastSyncVersion);

				$rootScope.sync.lastSync = lastTimestamp ? lastTimestamp.fromNow() : "never";

				$interval(function(){
					lastTimestamp = noLocalStorage.getItem(noSync_lastSyncVersion);				

					$rootScope.sync.lastSync = lastTimestamp ? lastTimestamp.fromNow() : "never";
				}, 1000);
			}

			return {
				link: _link,
				restrict: "E",
				template: "<div class='no-last-sync'>Last synced {{sync.lastSync}}</div>"
			};
		}])
	;
})(angular);
