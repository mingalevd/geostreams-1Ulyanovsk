(function($, geo) {

/* Utilities */

$.extend({
	foldl: function(acc, obj, callback) {
		$.each(obj, function(key, item) {
			var result = callback(item, acc, key);
			if (result !== undefined) acc = result;
		});
		return acc;
	}
});

var calcAge = function(format) {
	var when;
	var d = new Date(format);
	var now = $.now();
	var diff = Math.floor((now - d.getTime()) / 1000);
	var dayDiff = Math.floor(diff / 86400);
	var getAgo = function(ago, period) {
		return ago + " " + period + (ago == 1 ? "" : "s") + " Ago";
	};
	if (isNaN(dayDiff) || dayDiff < 0 || dayDiff >= 365) {
		when = d.toLocaleDateString() + ', ' + d.toLocaleTimeString();
	} else if (diff < 60) {
		when = getAgo(diff, 'Second');
	} else if (diff < 60 * 60) {
		diff = Math.floor(diff / 60);
		when = getAgo(diff, 'Minute');
	} else if (diff < 60 * 60 * 24) {
		diff = Math.floor(diff / (60 * 60));
		when = getAgo(diff, 'Hour');
	} else if (diff < 60 * 60 * 48) {
		when = "Yesterday";
	} else if (dayDiff < 7) {
		when = getAgo(dayDiff, 'Day');
	} else if (dayDiff < 14) {
		when = "Last Week";
	} else if (dayDiff < 30) {
		diff =  Math.floor(dayDiff / 7);
		when = getAgo(diff, 'Week');
	} else if (dayDiff < 60) {
		when = "Last month";
	} else if (dayDiff < 365) {
		diff =  Math.floor(dayDiff / 31);
		when = getAgo(diff, 'Month');
	}
	return when;
};

/* /Utilities  */

GeoStream = function(config) {
	if (!(config && config.target)) return;
	this.config = $.extend(true, {
		apiURL: "http://geostreams.appspot.com/",
		cdnURL: "",
		liveUpdatesTimeout: 15000
	}, config);
	this.data = {};
	this.data.items = [];
	this.init();
};

GeoStream.prototype = {
	constructor: GeoStream,
	init: function() {
		this.getGeoLocation($.proxy(function(data) {
			this.getReverseGeoLocation(data.coords.latitude, data.coords.longitude);
			this.data.coords = data.coords;
			this.apiCall("stream", {
				lat: data.coords.latitude,
				lng: data.coords.longitude,
				rds: this.data.rds || 10
			}, $.proxy(function(response) {
				this.data.items = response;
				this.config.target.append(this.constructItems(response));
				this.startLiveUpdates();
			}, this));
		}, this));
	},
	startLiveUpdates: function() {
		var self = this;
		var exists = function(list, element) {
			var result = false;
			$.each(list, function(i, el) {
				if (el.id == element.id) {
					result = true;
					return false;
				}
			});
			return result;
		};
		this.timeout = setTimeout(function() {
			var fun = arguments.callee;
			self.apiCall("stream", {
				lat: self.data.coords.latitude,
				lng: self.data.coords.longitude,
				rds: self.data.rds || 10
			}, function(response) {
				var liveUpdates = $.foldl([], response, function(item, acc) {
					if (!exists(self.data.items, item)) acc.unshift(item);
				});
				self.data.items = liveUpdates.concat(self.data.items);
				self.config.target.prepend(self.constructItems(liveUpdates));
				self.timeout = setTimeout(fun, self.config.liveUpdatesTimeout);
			});
		}, this.config.liveUpdatesTimeout);
	},
	constructItems: function(items) {
		return $.foldl($('<div class="geo-stream-wrapper"></div>'), items, function(item, container) {
		var age = calcAge(item.created_at);
		var constructName = function() {
			return item.source_type == "twitter"
				? '<a class="geo-stream-item-userLink" target="_blank" href="https://twitter.com/'+ item.from_user +'" title="@'+ item.from_user +'">'+ item.from_user_name +'</a>'
				: '<span class="geo-stream-item-userLink" title="'+ item.from_user +'">'+ item.from_user_name +'</span>';
		};
		var row = $('<div class="row">' +
				'<div class="span6 offset3">' +
					'<div class="hero-unit geo-stream-item-overlay">' +
						'<div class="geo-stream-item">' +
							'<div class="geo-stream-item-avatar">' +
								'<img src="'+ item.profile_image_url +'">' +
							'</div>' +
							'<div class="geo-stream-item-content">' +
								'<div class="geo-stream-item-userName">'+ constructName() + '<span class="geo-stream-item-via">via '+ item.source_type +'</span><span class="geo-stream-item-age">'+ age +'</span></div>' +
								'<div class="geo-stream-item-text">'+ item.text + '</div>' +
							'</div>' +
							'<div class="geo-stream-clear"></div>' +
						'</div>' +
						'<div class="geo-stream-item-gallery"></div>' +
					'</div>' +
				'</div>' +
			'</div>');
			if (item.entities.media.length) {
				new MediaGallery({
					target: $(".geo-stream-item-gallery", row),
					elements: $(
						$.foldl("", item.entities.media, function(media, acc) {
							if (media.type == "photo") {
								return (acc += '<img src="'+media.url+'">');
							}
						})
					)
				});
			}
			row.appendTo(container);
		});
	},
	getReverseGeoLocation: function(lat, lng) {
		var coordinates = new google.maps.LatLng(lat, lng);
		var geocoder = new google.maps.Geocoder();
		geocoder.geocode({"latLng": coordinates}, $.proxy(function(results, status) {
			if (status == google.maps.GeocoderStatus.OK) {
				this.config.onGetLocation && this.config.onGetLocation(results[1]);
			}
		}, this));
	},
	getGeoLocation: function(callback) {
		geo.getCurrentPosition(callback, function(){
			callback({'coords': {'latitude': 54.321614, 'longitude': 48.398814}});
		});
	},
	apiCall: function(endpoint, params, callback) {
		var config = this.config;
		$.get(config.apiURL + endpoint, params || {}, callback, "jsonp");
	}
};	
})(jQuery, navigator.geolocation);
