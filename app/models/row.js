import Ember from 'ember';
import DS from 'ember-data';
import { computed } from 'ember-decorators/object';

import { decimalOnePlacePercent } from '../utils/number-formatters';
import tableConfigs from '../table-config';

const { get, Logger, computed: { alias } } = Ember;

export default DS.Model.extend({
  // categorical information
  category: DS.attr('string'),
  profile: DS.attr('string'),
  variable: DS.attr('string'),
  variablename: DS.attr('string'),
  dataset: DS.attr('string'), // year
  year: DS.attr('string'), // year

  // all data
  base: DS.attr('string'),
  comparison_cv: DS.attr('number'),
  comparison_m: DS.attr('number'),
  comparison_percent: DS.attr('number'),
  comparison_percent_m: DS.attr('number'),
  comparison_sum: DS.attr('number'),
  cv: DS.attr('number'),
  m: DS.attr('number'),
  difference_sum: DS.attr('number'),
  difference_percent: DS.attr('number'),
  difference_m: DS.attr('number'),
  difference_percent_m: DS.attr('number'),

  notinprofile: DS.attr('string'),
  percent: DS.attr('number'),
  percent_m: DS.attr('number'),
  percent_significant: DS.attr('boolean'),
  producttype: DS.attr('string'),
  release_year: DS.attr('string'),
  significant: DS.attr('boolean'),
  is_reliable: DS.attr('boolean'),
  comparison_is_reliable: DS.attr('boolean'),
  sum: DS.attr('number'),
  unittype: DS.attr('string'),

  // groupings
  // these are used to group together similar type columns
  // into normalized mappings for components
  @computed('sum', 'm', 'cv', 'percent', 'percent_m', 'is_reliable')
  selection(sum, moe, cv, percent, percent_m, is_reliable) {
    return { sum, moe, cv, percent, percent_m, is_reliable };
  },

  @computed('comparison_sum', 'comparison_m', 'comparison_cv', 'comparison_percent', 'comparison_percent_m', 'comparison_is_reliable')
  comparison(sum, moe, cv, percent, percent_m, is_reliable) {
    return { sum, moe, cv, percent, percent_m, is_reliable };
  },

  @computed('base', 'variablename')
  isBase(base, variablename) {
    return base === variablename;
  },

  @computed('profile', 'category', 'variable', 'notinprofile')
  rowConfig(profile, category, variableName, notinprofile) {
    if (notinprofile) return {};

    const categoryNormalized = category.camelize();
    const variables = get(tableConfigs, `${profile}.${categoryNormalized}`) || [];
    const foundVariable = variables.findBy('data', variableName);

    if (!foundVariable && (profile !== 'decennial')) {
      Logger.warn(`Row configuration not found for ${profile}, ${category}, ${variableName}.
        Data may be misnamed in the layer-groups.
        Please make sure profile, category, and variable names
        are consistent in the database, and re-index.`);
    }

    return foundVariable;
  },

  isSpecial: alias('rowConfig.special'),

  // this is still used in another component
  @computed('sum', 'percent')
  selectedPercent(sum, percent) {
    // if (isSpecial) return null;
    if (sum > 0) {
      return decimalOnePlacePercent(percent);
    }

    return null;
  },

  // this is still used in another component
  @computed('sum', 'percent_m', 'isBase', 'isSpecial')
  selectedPercentM(sum, percentM, isBase, isSpecial) {
    if (isBase || isSpecial) return null;

    const floatedZ = parseFloat(percentM);
    if (sum > 0) {
      return decimalOnePlacePercent(floatedZ);
    }

    return null;
  },

  // this is still used in another component
  @computed('comparison_sum', 'comparison_percent')
  comparisonPercent(sum, percent) {
    if (sum > 0) {
      return decimalOnePlacePercent(percent);
    }

    return null;
  },

  // this is still used in another component
  @computed('comparison_sum', 'comparison_percent_m', 'isBase', 'isSpecial')
  comparisonPercentM(sum, percentM, isBase, isSpecial) {
    if (isBase || isSpecial) return null;

    const floatedZ = parseFloat(percentM);
    if (sum > 0) {
      return decimalOnePlacePercent(floatedZ);
    }

    return null;
  },

  // this is still used in another component
  @computed('comparison_sum', 'comparison_m')
  comparisonSumMoE(sum, m) {
    const floatedM = parseFloat(m);

    if (sum > 0) {
      return floatedM;
    }

    return null;
  },

  // if sum and comparison sum
  // are not numbers return blank
  // calculate on the server...
  @computed('sum', 'comparison_sum')
  differenceSum(sum, comparisonSum) {
    const difference = sum - comparisonSum;

    if (isNaN(sum) || isNaN(comparisonSum)) {
      return null;
    }

    return difference;
  },

  // calculate on the server
  @computed('m', 'comparison_m')
  differenceM(m, comparison_m) {
    const sumOfSquares = (((m) ** 2) + ((comparison_m) ** 2));
    const difference = Math.sqrt(sumOfSquares);
    if (isNaN(m) || isNaN(comparison_m)) {
      return null;
    }

    return difference.toFixed(1);
  },

  // calculate on the server
  @computed('percent', 'comparison_percent')
  differencePercent(percent, comparisonPercent) {
    const difference = (percent - comparisonPercent) * 100;

    if (isNaN(percent) || isNaN(comparisonPercent)) {
      return null;
    }

    return cleanPercent(difference);
  },

  // calculate on the server
  @computed('selectedPercentM', 'comparisonPercentM', 'isBase')
  differencePercentM(selectedPercentM, comparisonPercentM, isBase) {
    if (isBase) return null;

    const sumOfSquares = (((parseFloat(selectedPercentM)) ** 2) + ((parseFloat(comparisonPercentM)) ** 2));
    const difference = Math.sqrt(sumOfSquares);

    if (isNaN(parseFloat(selectedPercentM)) || isNaN(parseFloat(comparisonPercentM))) {
      return null;
    }

    return difference.toFixed(1);
  },
});

function cleanPercent(value) {
  let cleaned = value;
  if ((value < 0) && (value > -0.05)) cleaned = 0;
  return cleaned.toFixed(1);
}
