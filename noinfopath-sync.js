/**
 * @ngdoc
 * @module noinfopath-sync
 * 
 * 
 */
(function(angular,undefined){
	"use strict";
	angular.module('noinfopath.sync', [])
		.constant('NOSYNC_CONSTANTS', {
			"STATUS_CHANGED": "NoInfoPath::onlineStatusChanged"
		})

		.provider('noOnlineStatus', [function(){
			var currentStatus = "pending", 
				method = "ping", 
				timeout = 1000 * 60 * 10,
				endpointUri = "/ping",
				tests = {};

			tests.ping = ['$interval', '$http', 'noLogService', '$rootScope', 'NOSYNC_CONSTANTS', function($interval, $http, log, $rootScope, NOSYNC){
				var SELF = this;

				function ping() {
					currentStatus = "Pending";
					$rootScope.$broadcast(NOSYNC.STATUS_CHANGED, currentStatus)
					$http.get(endpointUri)
						.success(function(data, status, headers, config){
							currentStatus = "Online";
							$rootScope.$broadcast(NOSYNC.STATUS_CHANGED, currentStatus);
							$interval(SELF.ping,timeout);
						})
						.error(function(data, status, headers, config){
							currentStatus = "Offline";
							$rootScope.$broadcast(NOSYNC.STATUS_CHANGED, currentStatus);
							$interval(SELF.ping,timeout);
						});
				}			

				this.init = function() {
					ping();
				}

				this.current = function() { return currentStatus; }
				
				return this;
			}];

			this.setEndPointUri = function(uri){
				endpointUri = uri;
			}

			this.setTimeout = function(time){
				timeout = time;
			}

			this.$get =  tests[method];
		}])

		.directive('noStatus', ['NOSYNC_CONSTANTS','noOnlineStatus', function(NOSYNC, status){
			var dir = {
				restrict: 'E',
				scope: {},
				template: "<div class=\"pull-right\"><span>Connection Status: </span>{{currentStatus}}</div>",
				link: function(scope,element,attrs){
					scope.$on(NOSYNC.STATUS_CHANGED, function(e, newStatus){
						scope.currentStatus = status.current();
					});				
				}
			};

			return dir;
		}])
	;
})(angular);

