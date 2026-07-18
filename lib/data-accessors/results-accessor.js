'use strict';

const { db } = require('./db');
const Constants = require('../constants/Constants');

class ResultsAccessor {
  async getResults(experimentKey) {
    const query = `
      WITH exposures AS (
        SELECT 
          variant_key, 
          COUNT(DISTINCT visitor_id) AS exposure_count
        FROM ${Constants.Tables.ExposureEvents}
        WHERE experiment_key = $1
        GROUP BY variant_key
      ),
      conversions AS (
        SELECT 
          t.variant_key, 
          COUNT(DISTINCT t.visitor_id) AS conversion_count
        FROM ${Constants.Tables.TelemetryEvents} t
        INNER JOIN ${Constants.Tables.ExposureEvents} e ON 
          t.experiment_key = e.experiment_key AND 
          t.visitor_id = e.visitor_id AND 
          t.variant_key = e.variant_key
        WHERE t.experiment_key = $1 AND t.event_type = 'conversion'
        GROUP BY t.variant_key
      )
      SELECT 
        v.key AS variant_key,
        COALESCE(e.exposure_count, 0)::int AS exposures,
        COALESCE(c.conversion_count, 0)::int AS conversions
      FROM (
        SELECT jsonb_array_elements(variants)->>'key' AS key
        FROM ${Constants.Tables.Experiments}
        WHERE key = $1
      ) v
      LEFT JOIN exposures e ON v.key = e.variant_key
      LEFT JOIN conversions c ON v.key = c.variant_key;
    `;
    return await db.any(query, [experimentKey]);
  }
}

module.exports = new ResultsAccessor();
