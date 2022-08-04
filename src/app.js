
import jQuery from 'jquery';

window.$ = jQuery; 

import 'popper.js';
import 'bootstrap';

import instantsearch from 'instantsearch.js/es';
import {
  searchBox,
  infiniteHits,
  configure,
  stats,
  analytics,
  refinementList,
  menu,
  sortBy,
  currentRefinements,
} from 'instantsearch.js/es/widgets';
import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter';
import { SearchClient as TypesenseSearchClient } from 'typesense'; // To get the total number of docs
import images from '../images/*.*';
import STOP_WORDS from './utils/stop_words.json';


const anchorParams = new Proxy(
  new URLSearchParams(window.location.hash.replace('#', '')),
  {
    get: (anchorParams, prop) => anchorParams.get(prop),
  }
);

let TYPESENSE_SERVER_CONFIG = {
  apiKey: process.env.TYPESENSE_SEARCH_ONLY_API_KEY, // Be sure to use an API key that only allows searches, in production
  nodes: [
    {
      host: anchorParams.host ? anchorParams.host : process.env.TYPESENSE_HOST,
      port: process.env.TYPESENSE_PORT,
      protocol: process.env.TYPESENSE_PROTOCOL,
    },
  ],
  numRetries: 8,
  useServerSideSearchCache: true,
};

if (process.env[`TYPESENSE_HOST_2`]) {
  TYPESENSE_SERVER_CONFIG.nodes.push({
    host: anchorParams.host
      ? anchorParams.host
      : process.env[`TYPESENSE_HOST_2`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  });
}

if (process.env[`TYPESENSE_HOST_3`]) {
  TYPESENSE_SERVER_CONFIG.nodes.push({
    host: anchorParams.host
      ? anchorParams.host
      : process.env[`TYPESENSE_HOST_3`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  });
}

if (process.env[`TYPESENSE_HOST_NEAREST`]) {
  TYPESENSE_SERVER_CONFIG['nearestNode'] = {
    host: anchorParams.host
      ? anchorParams.host
      : process.env[`TYPESENSE_HOST_NEAREST`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  };
}

const INDEX_NAME = process.env.TYPESENSE_COLLECTION_NAME;

async function getIndexSize() {
  let typesenseSearchClient = new TypesenseSearchClient(
    TYPESENSE_SERVER_CONFIG
  );
  let results = await typesenseSearchClient
    .collections(INDEX_NAME)
    .documents()
    .search({ q: '*' });

  return results['found'];
}

let indexSize;

(async () => {
  indexSize = await getIndexSize();
})();

function iconForUrlObject(urlObject) {
  return images['spotify_icon']['svg'];
  /*if (
    urlObject['type'] === 'amazon asin' ||
    urlObject['url'].includes('amazon.com')
  ) {
    return images['amazon_icon']['svg'];
  } else if (urlObject['url'].includes('spotify.com')) {
    return images['spotify_icon']['svg'];
  } else if (urlObject['url'].includes('itunes.apple.com')) {
    return images['itunes_icon']['svg'];
  } else if (urlObject['url'].includes('music.apple.com')) {
    return images['apple_music_icon']['svg'];
  } else if (urlObject['url'].includes('youtube.com')) {
    return images['youtube_icon']['svg'];
  } else if (urlObject['url'].includes('soundcloud.com')) {
    return images['soundcloud_icon']['svg'];
  } else if (
    urlObject['url'].includes('tidal.com') ||
    urlObject['url'].includes('tidalhifi.com')
  ) {
    return images['tidal_icon']['svg'];
  } else if (urlObject['url'].includes('play.google.com')) {
    return images['google_play_icon']['svg'];
  } else if (urlObject['url'].includes('bandcamp.com')) {
    return images['bandcamp_icon']['svg'];
  } else if (urlObject['url'].includes('deezer.com')) {
    return images['deezer_icon']['svg'];
  } else if (urlObject['url'].includes('archive.org')) {
    return images['archive_icon']['svg'];
  } else {
    return images['generic_song_link_icon']['svg'];
  }*/
}

function queryWithoutStopWords(query) {
  const words = query.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '').split(' ');
  return words
    .map(word => {
      if (STOP_WORDS.includes(word.toLowerCase())) {
        return null;
      } else {
        return word;
      }
    })
    .filter(w => w)
    .join(' ')
    .trim();
}

const typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
  server: TYPESENSE_SERVER_CONFIG,
  // The following parameters are directly passed to Typesense's search API endpoint.
  //  So you can pass any parameters supported by the search endpoint below.
  //  queryBy is required.
  additionalSearchParameters: {
    query_by: 'filename, extention, URL, server,owner, group',
    query_by_weights: '3,2,1,2,1,1',
    sort_by: '_text_match(buckets: 10):desc'
  },
});

const searchClient = typesenseInstantsearchAdapter.searchClient;

const search = instantsearch({
  searchClient,
  indexName: INDEX_NAME,
  routing: true,
  searchFunction(helper) {
    if (helper.state.query === '') {
      $('#results-section').addClass('d-none');
    } else {
      $('#results-section').removeClass('d-none');
      helper.search();
    }
  },
});

search.addWidgets([
  searchBox({
    container: '#searchbox',
    showSubmit: false,
    showReset: false,
    placeholder: 'Type in a filename or a part of a filename',
    autofocus: true,
    cssClasses: {
      input: 'form-control',
    },
    queryHook(query, search) {
      const modifiedQuery = queryWithoutStopWords(query);
      if (modifiedQuery.trim() !== '') {
        search(modifiedQuery);
      }
    },
  }),

  analytics({
    pushFunction(formattedParameters, state, results) {
      window.ga(
        'set',
        'page',
        (window.location.pathname + window.location.search).toLowerCase()
      );
      window.ga('send', 'pageView');
    },
  }),

  stats({
    container: '#stats',
    templates: {
      text: ({ nbHits, hasNoResults, hasOneResult, processingTimeMS }) => {
        let statsText = '';
        if (hasNoResults) {
          statsText = 'No results';
        } else if (hasOneResult) {
          statsText = '1 result';
        } else {
          statsText = `${nbHits.toLocaleString()} results`;
        }
        return `${statsText} found ${
          indexSize ? ` - Searched ${indexSize.toLocaleString()} files` : ''
        } in ${processingTimeMS}ms.`;
      },
    },
  }),
  infiniteHits({
    container: '#hits',
    cssClasses: {
      list: 'list-unstyled grid-container',
      item: 'd-flex flex-column search-result-card bg-light-2 p-3',
      loadMore: 'btn btn-primary mx-auto d-block mt-4',
    },
    templates: {
      item: `
            <h6 class="text-primary font-weight-light font-letter-spacing-loose mb-0">
              {{#helpers.highlight}}{ "attribute": "filename" }{{/helpers.highlight}}
            </h6>
            <div>
              URL : 
              <a role="button" class="clickable-search-term">{{#helpers.highlight}}{ "attribute": "filename" }{{/helpers.highlight}}</a>
            </div>
            <div>
              extention : {{#helpers.highlight}}{ "attribute": "extention" }{{/helpers.highlight}}
            </div>
            <div>
              creation time : {{#helpers.highlight}}{ "attribute": "creation_time" }{{/helpers.highlight}}
            </div>
            <div>
              MIME type : {{#helpers.highlight}}{ "attribute": "mime_type" }{{/helpers.highlight}}
            </div>
            <div>
              server : {{#helpers.highlight}}{ "attribute": "server" }{{/helpers.highlight}}
            </div>
          <div class="text-muted small mb-2">
              {{ filename }}
            </div>

            <div class="mt-auto text-right">
              {{#urls}}
              <a href="{{ filename }}" target="_blank" class="ml-1"><img src="{{ URL}}" alt="{{ filename }}" height="14"></a>
              {{/urls}}
            </div>
        `,
      empty: 'No files found for <q>{{ query }}</q>. Try another search term.',
    },
    transformItems: items => {
      return items.map(item => {
        return {
          ...item,
          creation_time_display: (() => {
            const parsedDate = new Date(item.creation_time * 1000);
            return `${parsedDate.getUTCFullYear()}/${(
              '0' +
              (parsedDate.getUTCMonth() + 1)
            ).slice(-2)}`;
          })(),
  /*        urls: item.urls.map(urlObj => {
            return {
              icon: iconForUrlObject(urlObj),
              ...urlObj,
            };
          }),*/
        };
      });
    },
  }),
 refinementList({
    container: '#extention-refinement-list',
    attribute: 'extention',
    searchable: true,
    searchablePlaceholder: 'Search extention',
    showMore: true,
    cssClasses: {
      searchableInput: 'form-control form-control-sm mb-2 border-light-2',
      searchableSubmit: 'd-none',
      searchableReset: 'd-none',
      showMore: 'btn btn-secondary btn-sm align-content-center',
      list: 'list-unstyled',
      count: 'badge badge-light bg-light-2 ml-2',
      label: 'd-flex align-items-center',
      checkbox: 'mr-2',
    },
  }),
  refinementList({
    container: '#server-refinement-list',
    attribute: 'server',
    searchable: true,
    searchablePlaceholder: 'Search by server',
    showMore: true,
    cssClasses: {
      searchableInput: 'form-control form-control-sm mb-2 border-light-2',
      searchableSubmit: 'd-none',
      searchableReset: 'd-none',
      showMore: 'btn btn-secondary btn-sm align-content-center',
      list: 'list-unstyled',
      count: 'badge badge-light bg-light-2 ml-2',
      label: 'd-flex align-items-center',
      checkbox: 'mr-2',
    },
  }),
  refinementList({
    container: '#mime-refinement-list',
    attribute: 'mime_type',
    searchable: true,
    searchablePlaceholder: 'Search release types',
    showMore: true,
    cssClasses: {
      searchableInput: 'form-control form-control-sm mb-2 border-light-2',
      searchableSubmit: 'd-none',
      searchableReset: 'd-none',
      showMore: 'btn btn-secondary btn-sm',
      list: 'list-unstyled',
      count: 'badge badge-light bg-light-2 ml-2',
      label: 'd-flex align-items-center',
      checkbox: 'mr-2',
    },
  }),
  refinementList({
    container: '#owner-refinement-list',
    attribute: 'owner',
    searchable: true,
    searchablePlaceholder: 'Search owners',
    showMore: true,
    cssClasses: {
      searchableInput: 'form-control form-control-sm mb-2 border-light-2',
      searchableSubmit: 'd-none',
      searchableReset: 'd-none',
      showMore: 'btn btn-secondary btn-sm',
      list: 'list-unstyled',
      count: 'badge badge-light bg-light-2 ml-2',
      label: 'd-flex align-items-center',
      checkbox: 'mr-2',
    },
  }),
  refinementList({
    container: '#group-refinement-list',
    attribute: 'group',
    searchable: true,
    searchablePlaceholder: 'Search owners',
    showMore: true,
    cssClasses: {
      searchableInput: 'form-control form-control-sm mb-2 border-light-2',
      searchableSubmit: 'd-none',
      searchableReset: 'd-none',
      showMore: 'btn btn-secondary btn-sm',
      list: 'list-unstyled',
      count: 'badge badge-light bg-light-2 ml-2',
      label: 'd-flex align-items-center',
      checkbox: 'mr-2',
    },
  }),  /*
  menu({
    container: '#creation-time-selector',
    attribute: 'creation-time-',
   // sortBy: ['name:asc'],
    cssClasses: {
      list: 'list-unstyled',
      item: 'pl-2 mb-2 text-normal',
      count: 'badge badge-light bg-light-2 ml-2',
      selectedItem: 'bg-secondary p-2 pl-3',
    },
  }), */
  configure({
    hitsPerPage: 15,
  }),
  sortBy({
    container: '#sort-by',
    items: [
      { label: 'Recent first', value: `${INDEX_NAME}` },
      { label: 'Oldest first', value: `${INDEX_NAME}/sort/creation_time:asc` },
    ],
    cssClasses: {
      select: 'custom-select custom-select-sm',
    },
  }),
  currentRefinements({
    container: '#current-refinements',
    cssClasses: {
      list: 'list-unstyled',
      label: 'd-none',
      item: 'h5',
      category: 'badge badge-light bg-light-2 px-3',
      delete: 'btn btn-sm btn-link p-0 pl-2',
    },
    transformItems: items => {
      const modifiedItems = items.map(item => {
        return {
          ...item,
          label: '',
        };
      });
      return modifiedItems;
    },
  }),
]);

function handleSearchTermClick(event) {
  const $searchBox = $('#searchbox input[type=search]');
  search.helper.clearRefinements();
  $searchBox.val(event.currentTarget.textContent);
  search.helper.setQuery($searchBox.val()).search();
}

search.on('render', function() {
  // Make file names clickable
  $('#hits .clickable-search-term').on('click', handleSearchTermClick);
});

search.start();

$(function() {
  const $searchBox = $('#searchbox input[type=search]');
  // Set initial search term
   //if ($searchBox.val().trim() === '') {
   //  $searchBox.val('file');
   //  search.helper.setQuery($searchBox.val()).search();
  // }

  // Handle example search terms
  $('.clickable-search-term').on('click', handleSearchTermClick);

  // Clear refinements, when searching
  $searchBox.on('keydown', event => {
    search.helper.clearRefinements();
  });

  if (!matchMedia('(min-width: 768px)').matches) {
    $searchBox.on('focus, keydown', () => {
      $('html, body').animate(
        {
          scrollTop: $('#searchbox-container').offset().top,
        },
        500
      );
    });
  }
});
