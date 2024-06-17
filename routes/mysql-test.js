const db = require("../config/mysql_db").promise();

//predefined queries
const predefinedQueries = [
  {
    query: `SELECT 
      city.CountryCode AS Code,
      country.Name AS Country,
      GROUP_CONCAT(DISTINCT city.Name SEPARATOR ', ') AS Cities,
      GROUP_CONCAT(DISTINCT countrylanguage.Language SEPARATOR ', ') AS Languages
    FROM 
        city
    INNER JOIN 
        country ON city.CountryCode = country.Code
    INNER JOIN 
        countrylanguage ON city.CountryCode = countrylanguage.CountryCode
    WHERE 
        city.CountryCode LIKE ? '%'
    GROUP BY 
      city.CountryCode, country.Name;`,
    params: ["Code"], //specify the expected parameters
  },
];

async function runQuery(params) {
  try {
    //extract the first query and its expected parameters
    const { query, params: queryParams } = predefinedQueries[0];
    const queryValues = queryParams.map((param) => params[param]);

    //execute the query with the provided parameters
    const [results] = await db.query(query, queryValues);

    //return the combined result rows
    return results;
  } catch (err) {
    console.error("MySQL Error:", err.sqlMessage);
    const error = {
      data: null,
      error: {
        message: err.message,
        sqlState: err.sqlState,
        errno: err.errno,
        code: err.code,
        sqlMessage: err.sqlMessage,
      },
    };
    return error;
  }
}

//function to fetch suggestions based on parameters
async function getSuggestions(params) {
  try {
    const { param, input } = params; //extract the parameter to be suggested and input

    if (!param || !input) {
      throw new Error(
        "Parameters 'param' and 'input' are required for suggestions"
      );
    }
    //find the corresponding query for the param
    const queryObject = predefinedQueries.find((q) => q.params.includes(param));
    if (!queryObject) {
      throw new Error(`No suggestion query found for parameter: ${param}`);
    }
    const query = queryObject.query;
    const values = [`${input}%`]; //adjust to match the first character of input

    const [results] = await db.query(query, values);
    //extract the suggestions from the result
    const suggestions = results.map((row) => row[param]);

    return suggestions;
  } catch (err) {
    console.error(err);
    throw new Error(err.message);
  }
}
//function to extract and return query parameters
function getQueryParams() {
  const params = {};
  //iterate over each predefined query
  predefinedQueries.forEach(({ params: queryParams }) => {
    //iterate over each parameter in the query
    queryParams.forEach((param) => {
      params[param] = {
        type: "string", //assuming all params are strings for simplicity
        required: true,
      };
    });
  });
  return params;
}

//function to run the report based on provided parameters
async function runReport(params) {
  try {
    //extract query parameters
    const queryParams = getQueryParams();
    //validate if the required parameters are present in the req
    const missingParams = Object.keys(queryParams).filter(
      (paramName) => queryParams[paramName].required && !params[paramName]
    );
    //if there are missing required parameters, throw an error
    if (missingParams.length > 0) {
      throw new Error(
        `Missing required parameters: ${missingParams.join(", ")}`
      );
    }
    //run the query with the correct parameters
    const result = await runQuery(params);

    return { data: result, parameters: queryParams };
  } catch (err) {
    console.error(err);
    return { data: null, error: err.message };
  }
}

module.exports = { runQuery, runReport, getQueryParams, getSuggestions };
