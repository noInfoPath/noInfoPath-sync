//globals.js
/*
*	# noinfopath-sync
*	@version 2.0.20
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
		this.inProgress = false;
		this.state = "connecting";


		Object.defineProperty(this, "lastSync", {
			get: function(){
				var t = moment(this.lastSyncTimestamp).fromNow();
				return t === "Invalid date" ? "never" : t;
			}
		});

		Object.defineProperty(this, "needChanges", {
			get: function(){

				return this.previousVersion > 0 && this.version < this.previousVersion;
			}
		});

		var _internalDate;
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

		var _prevVersion = 0;
		Object.defineProperty(this, "previousVersion", {
			get: function(){

				return _prevVersion;
			}
		});

		var _version = 0;
		Object.defineProperty(this, "version", {
			get: function(){
				return _version;
			},
			set: function(v) {
				__prevVersion = _version;
				_version = v;
			}
		});

		//Merge with data
		if(data) {
			this.lastSyncTimestamp = data.lastSyncTimestamp || this.lastSyncTimestamp;
			this.version = data.version || this.version;
		}

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
		}
	}

	NoSyncData.fromJSON = function(data) {
		var tmp = angular.isString(data) ? JSON.parse(data) : data;
			obj = new NoSyncData(tmp);

		return obj;
	};

	noInfoPath.NoSyncData = NoSyncData;

	angular.module("noinfopath.sync", []);
})(angular);
