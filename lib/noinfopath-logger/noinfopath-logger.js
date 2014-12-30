

/**
 * 
 */

(function(angular,undefined){
	"use strict";
	angular.module('noinfopath.logger',[])

 		/**
 		 * @drective noLog
 		 * @param  {String} ){ 			var        logTemplate [description]
 		 * @return {[type]}     [description]
 		 */
 		.directive('noLog', ['noLogService', function(log){
 			var logTemplate = 
 				"<ul class=\"no-log\">" +
 				"<li ng-repeat=\"msg in logger \">" + 
 				"<span>[{{msg.time | date:'yyyy-MM-dd HH:mm:ss'}}]</span> " +
 				"<span>{{msg.text}}</span>" + 				
 				"</li></ul>",
 				dir = {
 					restrict: "E",
 					scope: {},
	 				template: logTemplate,
	 				link: function(scope){
	 					scope.logger = log.read()
	 				}
				 };

			  return dir;
 		}])

 		/**
 		 * [description]
 		 * @param  {[type]} $log           [description]
 		 * @param  {Array}  $filter){     			var        log [description]
 		 * @param  {String} consoleMessage [description]
 		 * @return {[type]}                [description]
 		 */
 		.service('noLogService', ['$log','$filter', '$rootScope', function($log, $filter, $rootScope){
 			var log = [];

 			
 			/**
 			 * [updateLog description]
 			 * @param  {[type]} msg [description]
 			 * @return {[type]}     [description]
 			 */
 			function updateLog(msg){
 				var logMessage = {
	 					text: angular.isObject(msg) ? angular.toJson(msg) : msg,
	 					time: new Date()
	 				},
	 				consoleMessage = 
	 					"[" + 
	 					$filter('date')(logMessage.time, 'yyyy-MM-dd HH:mm:ss') + 
	 					"] " +
	 					logMessage.text
 				;

 				$log.log(consoleMessage);
				log.push(logMessage);
 			}

 			this.write = updateLog;
 			/**
 			 * [getLog description]
 			 * @return {[type]} [description]
 			 */
 			function getLog(){
 				return log;
 			}
 			this.read = getLog;
 		}])
	;
})(angular)
