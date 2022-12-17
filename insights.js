function initAlgoliaInsights() {

    initAlgoliaInsightsScript();

    function getCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i=0;i < ca.length;i++) {
            var c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    }

    function loadScript (url) {
        let script = document.createElement('script')
        script.setAttribute('type', 'text/javascript')
        script.setAttribute('src', url)
        document.head.append(script)
    
        return new Promise((resolve) => script.addEventListener('load', resolve))
    }

    searchInsightsInitialized = false;

    async function initAlgoliaInsightsScript() {

        if( window.algoliaInsightsJs ) {
        
            if (searchInsightsInitialized) {
                return
            }
        
            searchInsightsInitialized = true; 
        
            await loadScript(window.algoliaInsightsJs);

            postInit();
        }
  
    }

    function postInit() {

        algoliaAnalytics = algoliaAnalyticsWrapper.default;

        var algoliaInsights = {
            config: null,
            defaultIndexName: null,
            isTracking: false,
            hasAddedParameters: false,
    
            track: function (algoliaConfig) {
    
                if (this.isTracking) {
                    return;
                }
    
                this.config = algoliaConfig;
                this.defaultIndexName = algoliaConfig.indexName + '_products';
    
                if (algoliaConfig.ccAnalytics.enabled
                    || algoliaConfig.personalization.enabled) {
    
                    this.initializeAnalytics();
                    this.addSearchParameters();
                    this.bindData();
                    this.bindEvents();
    
                    this.isTracking = true;
                }
            },
    
            initializeAnalytics: function () {

                algoliaAnalytics.init({
                    appId: this.config.applicationId,
                    apiKey: this.config.apiKey
                });
    
                var userAgent = 'insights-js-in-magento (' + this.config.extensionVersion + ')';
                algoliaAnalytics.addAlgoliaAgent(userAgent);
    
                var userToken = getCookie('aa-search');
                if (userToken && userToken !== '') algoliaAnalytics.setUserToken(userToken);
    
            },
    
            addSearchParameters: function () {
    
                // if (this.hasAddedParameters) {
                //     return;
                // }
    
                // algolia.registerHook('beforeWidgetInitialization', function (allWidgetConfiguration) {
                //     allWidgetConfiguration.configure = allWidgetConfiguration.configure || {};
                //     if (algoliaConfig.ccAnalytics.enabled) {
                //         allWidgetConfiguration.configure.clickAnalytics = true;
                //     }
    
                //     if (algoliaConfig.personalization.enabled) {
                //         allWidgetConfiguration.configure.enablePersonalization = true;
                //         allWidgetConfiguration.configure.userToken = algoliaAnalytics.getUserToken();
                //     }
    
                //     return allWidgetConfiguration;
                // });
    
                // this.hasAddedParameters = true;
    
            },
    
            bindData: function () {
    
                var persoConfig = this.config.personalization;
    
                if (persoConfig.enabled && persoConfig.clickedEvents.productRecommended.enabled) {
                    $(persoConfig.clickedEvents.productRecommended.selector).each(function (index, element) {
                        if ($(element).find('[data-role="priceBox"]').length) {
                            var objectId = $(element).find('[data-role="priceBox"]').data('product-id');
                            $(element).attr('data-objectid', objectId);
                        }
                    });
                }
            },
    
            bindEvents: function () {
    
                this.bindClickedEvents();
                this.bindViewedEvents();
    
                algolia.triggerHooks('afterInsightsBindEvents', this);
    
            },
    
            bindClickedEvents: function () {
    
                var self = this;

                document.querySelector('input.aa-Input').addEventListener('autocomplete:selected', function() {
                    
                    if( !suggestion.__queryID && getCookie('latestAlgoliaQueryID') ) {
                        suggestion.__queryID = getCookie('latestAlgoliaQueryID');
                    }

                    var eventData = self.buildEventData(
                        'Clicked', suggestion.objectID, suggestion.__indexName, suggestion.__position, suggestion.__queryID
                    );
                    self.trackClick(eventData);

                });

                if (this.config.ccAnalytics.enabled || this.config.personalization.enabled) {
    
                    // Clicked Events
                    var clickEvents = Object.keys(this.config.personalization.clickedEvents);

                    for (var i = 0; i < clickEvents.length; i++) {
                        
                        let clickEvent = this.config.personalization.clickedEvents[clickEvents[i]];
                
                        if (clickEvent.enabled && clickEvent.method == 'clickedObjectIDs') {

                            clickEvent.clickHandlerFunction = document.addEventListener('click', function(e) {

                                let clickTarget = e.target;

                                let resultElement = clickTarget.closest(clickEvent.selector)

                                if (resultElement !== null) {

                                    if (resultElement.dataset.clicked) return;

                                    // New
                                    var event = clickEvent;
                                    var eventData = self.buildEventData(
                                        event.eventName,
                                        resultElement.dataset.objectid,
                                        resultElement.dataset.indexname ? resultElement.dataset.indexname : self.defaultIndexName,
                                        resultElement.dataset.position
                                    );
        
                                    self.trackClick(eventData);
                                    resultElement.setAttribute('data-clicked', true);
                                    
                                }

                            });

                        }
                    }
    
                    // Filter Clicked
                    if (this.config.personalization.filterClicked.enabled) {
                        var facets = this.config.facets;
                        var containers = [];
                        for (var i = 0; i < facets.length; i++) {
                            var elem = createISWidgetContainer(facets[i].attribute);
                            containers.push('.' + elem.className);
                        }
    
                        algolia.registerHook('afterInstantsearchStart', function (search, algoliaBundle) {
                            var selectors = document.querySelectorAll(containers.join(', '));
                            selectors.forEach(function (e) {
                                e.addEventListener('click', function (event) {
                                    var attribute = this.dataset.attr;
                                    var elem = event.target;
                                    if (elem.tagName.toLowerCase() === 'input' &&
                                    elem.getAttribute('type') === 'checkbox' && 
                                    elem.checked) {
                                        var filter = attribute + ':' + elem.value;
                                        self.trackFilterClick([filter]);
                                    }
                                });
                            });
    
                            return search;
                        });
                    }

                    // Product Added to Cart conversion
    
                    if (document.body.classList.contains('catalog-product-view') && getCookie('latestAlgoliaQueryID')) {
                        let elem = document.querySelector ('#product_addtocart_form');
                        let queryIdInput = '<input type="hidden" name="queryId" value="' + getCookie('latestAlgoliaQueryID') + '" />';
                        elem.innerHTML = elem.innerHTML + queryIdInput;
                    }

                    if( document.querySelector('body').classList.contains('catalog-product-view')) {
                        var objectId = document.querySelector('#product_addtocart_form input[name="product"]').value;
                        if (objectId) {
                            var viewData = self.buildEventData("Add To Cart", objectId, self.defaultIndexName);
                            document.getElementById('addtocart').onclick = function(){
                                self.trackConversion(viewData);
                            }
                        }
                    }

                }
            },
    
            getClickedEventBySelector: function (selector) {
    
                var events = this.config.personalization.clickedEvents,
                    keys = Object.keys(events);
    
                for (var i = 0; i < keys.length; i++) {
                    if (events[keys[i]].selector == selector) {
                        return events[keys[i]];
                    }
                }
    
                return {};
            },
    
            bindViewedEvents: function () {
    
                var self = this;
    
                // viewed event is exclusive to personalization
                if (!this.config.personalization.enabled) {
                    return;
                }
    
                var viewConfig = this.config.personalization.viewedEvents.viewProduct;
                if (viewConfig.enabled) {
                    if( document.querySelector('body').classList.contains('catalog-product-view')) {
                        var objectId = document.querySelector('#product_addtocart_form input[name="product"]').value;
                        if (objectId) {
                            var viewData = self.buildEventData(viewConfig.eventName, objectId, self.defaultIndexName);
                            self.trackView(viewData);
                        }
                    }
                }
            },
    
            buildEventData: function (eventName, objectId, indexName, position = null, queryId = null) {
    
                var eventData = {
                    eventName: eventName,
                    objectIDs: [objectId + ''],
                    index: indexName
                };
    
                if (position) {
                    eventData.positions = [parseInt(position)];
                }

                if( !queryId && getCookie('latestAlgoliaQueryID') ) {
                    queryId = getCookie('latestAlgoliaQueryID');
                }
    
                if (queryId) {
                    eventData.queryID = queryId;
                }
    
                return eventData;
            },
    
            trackClick: function (eventData) {
                if( !eventData.queryID && getCookie('latestAlgoliaQueryID') ) {
                    eventData.queryID = getCookie('latestAlgoliaQueryID');
                }
                if (eventData.queryID) {
                    algoliaAnalytics.clickedObjectIDsAfterSearch(eventData);
                } else {
                    algoliaAnalytics.clickedObjectIDs(eventData);
                }
            },
    
            trackFilterClick: function (filters) {
    
                var eventData = {
                    index: this.defaultIndexName,
                    eventName: this.config.personalization.filterClicked.eventName,
                    filters: filters
                };
    
                algoliaAnalytics.clickedFilters(eventData);
            },
    
            trackView: function (eventData) {
                algoliaAnalytics.viewedObjectIDs(eventData);
            },
    
            trackConversion: function (eventData) {
                if( !eventData.queryID && getCookie('latestAlgoliaQueryID') ) {
                    eventData.queryID = getCookie('latestAlgoliaQueryID');
                }
                console.log(eventData);
                if (eventData.queryID) {
                    algoliaAnalytics.convertedObjectIDsAfterSearch(eventData);
                } else {
                    algoliaAnalytics.convertedObjectIDs(eventData);
                }
            }
    
        };
    
        algoliaInsights.addSearchParameters();
        
        if (window.algoliaConfig) {
            algoliaInsights.track(algoliaConfig);
        }

    }

}

initAlgoliaInsights();
