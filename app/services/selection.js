import Ember from 'ember';
import carto from '../utils/carto';
import pointLayer from '../layers/point-layer';
import searchResultLayer from '../layers/search-result-layer';

import { computed } from 'ember-decorators/object'; // eslint-disable-line

import summaryLevelQueries from '../queries/summary-levels';
import config from '../config/environment';

const DEFAULT_SELECTION = config.DEFAULT_SELECTION;
const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };

const SUM_LEVEL_DICT = {
  blocks: { sql: summaryLevelQueries.blocks(false), tracts: 'boroct2010' },
  tracts: { sql: summaryLevelQueries.tracts(false), ntas: 'ntacode', blocks: 'boroct2010' },
  ntas: { sql: summaryLevelQueries.ntas(false), tracts: 'ntacode' },
  pumas: 'something_else',
};

const findUniqueBy = function(collection, id) {
  return collection
    .uniqBy(`properties.${id}`)
    .mapBy(`properties.${id}`);
};

export default Ember.Service.extend({
  current: DEFAULT_SELECTION,
  summaryLevel: 'tracts', // tracts, blocks, ntas, pumas

  currentMapInstance: null,

  @computed('current')
  selectedCount(currentSelected) {
    return currentSelected.features.length;
  },

  @computed('current')
  sortedLabels(currentSelected) {
    const { features } = currentSelected;

    const bronx = features.filter(d => d.properties.borocode === '2');
    const brooklyn = features.filter(d => d.properties.borocode === '3');
    const manhattan = features.filter(d => d.properties.borocode === '1');
    const queens = features.filter(d => d.properties.borocode === '4');
    const statenisland = features.filter(d => d.properties.borocode === '5');

    return [
      {
        label: 'Bronx',
        features: bronx,
      },
      {
        label: 'Brooklyn',
        features: brooklyn,
      },
      {
        label: 'Manhattan',
        features: manhattan,
      },
      {
        label: 'Queens',
        features: queens,
      },
      {
        label: 'Staten Island',
        features: statenisland,
      },
    ];
  },

  pointLayer,
  currentAddress: null,

  searchResultFeature: null,
  searchResultLayer,

  @computed('currentAddress')
  addressSource(currentAddress) {
    return {
      type: 'geojson',
      data: {
        type: 'Point',
        coordinates: currentAddress,
      },
    };
  },

  @computed('searchResultFeature')
  searchResultSource(feature) {
    return {
      type: 'geojson',
      data: feature,
    };
  },

  // methods
  handleSummaryLevelToggle(toLevel) {
    const fromLevel = this.get('summaryLevel');
    this.set('summaryLevel', toLevel);

    // remove mapbox neighborhood labels if current Level is NTAs
    const map = this.get('currentMapInstance');
    if (map) {
      if (toLevel === 'ntas') {
        map.setLayoutProperty('place-neighbourhood', 'visibility', 'none');
      } else {
        map.setLayoutProperty('place-neighbourhood', 'visibility', 'visible');
      }
    }

    // sigh...
    if (
      (toLevel === 'pumas' && fromLevel === 'ntas')
      || (toLevel === 'pumas' && fromLevel === 'tracts')
      || (toLevel === 'ntas' && fromLevel === 'pumas')
      || (toLevel === 'blocks' && fromLevel === 'ntas')
      || (toLevel === 'blocks' && fromLevel === 'pumas')
      || (toLevel === 'ntas' && fromLevel === 'blocks')
      || (toLevel === 'pumas' && fromLevel === 'blocks')
    ) {
      this.clearSelection();
      return;
    }

    if (this.get('selectedCount')) {
      this.explode(fromLevel, toLevel);
    } else {
      this.clearSelection();
    }
  },

  // target table is the TO and filter ID is the FROM;
  explode(fromLevel, to) {
    const crossWalkFromColumn = SUM_LEVEL_DICT[to][fromLevel];
    const crossWalkToTable = SUM_LEVEL_DICT[to].sql;

    const filterIds = findUniqueBy(this.get('current.features'), crossWalkFromColumn).join("','");
    const sqlQuery = `SELECT * FROM (${crossWalkToTable}) a WHERE ${crossWalkFromColumn} IN ('${filterIds}')`;

    carto.SQL(sqlQuery, 'geojson')
      .then((json) => {
        this.clearSelection();
        this.set('current', json);
      });
  },

  handleSelectedFeatures(features = []) {
    const selected = this.get('current');

    features.forEach((feature) => {
      const { type, geometry, properties } = feature;

      const inSelection = selected.features.find(
        selectedFeature => selectedFeature.properties.geoid === properties.geoid,
      );

      if (inSelection === undefined) {
        selected.features.push({
          type,
          geometry,
          properties,
        });
      } else {
        const newFeatures = selected.features.filter(
          selectedFeature => selectedFeature.properties.geoid !== properties.geoid,
        );

        this.set('current.features', newFeatures);
      }
    });

    this.set(
      'current',
      { type: 'FeatureCollection', features: selected.features },
    );
  },

  clearSelection() {
    // not sure why we have to do both of these lines, but it works
    this.set('current', EMPTY_GEOJSON);
    this.set('current.features', []);
  },
});
