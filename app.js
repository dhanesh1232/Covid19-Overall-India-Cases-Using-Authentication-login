const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
app.use(express.json());
//Server Initialization
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();
//Middleware Authentication API
const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authorHeader = request.headers["authorization"];
  //console.log(authorHeader);
  if (authorHeader !== undefined) {
    jwtToken = authorHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "myUserLogin", async (error, payload) => {
      if (error) {
        //console.log("Dhanesh");
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//GET user API
app.get("/user/", authenticationToken, async (request, response) => {
  const getUserQuery = `
        SELECT
         * 
        FROM 
         user;`;
  const userArray = await db.all(getUserQuery);
  response.send(userArray);
});
//Login user API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  //console.log(dbUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const hisValidPassword = await bcrypt.compare(password, dbUser.password);
    if (hisValidPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "myUserLogin");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//Convert Words CamelCase
const changeWordsCaseState = (each) => {
  return {
    stateId: each.state_id,
    stateName: each.state_name,
    population: each.population,
  };
};
//Convert Words CamelCase
const changeWordsCaseDistrict = (each) => {
  return {
    districtId: each.district_id,
    districtName: each.district_name,
    stateId: each.state_id,
    cases: each.cases,
    cured: each.cured,
    active: each.active,
    deaths: each.deaths,
  };
};
//Get states Data API
app.get("/states/", authenticationToken, async (request, response) => {
  const getStateQuery = `SELECT * FROM state ORDER BY state_id;`;
  const stateArray = await db.all(getStateQuery);
  response.send(stateArray.map((eachState) => changeWordsCaseState(eachState)));
});
//Get state Data API
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = '${stateId}';`;
  const state = await db.get(getStateQuery);
  response.send(changeWordsCaseState(state));
});
//Get district Data API
app.get("/districts/", authenticationToken, async (request, response) => {
  const getDistQuery = `SELECT * FROM district;`;
  const distArray = await db.all(getDistQuery);
  response.send(distArray);
});
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistQuery = `SELECT * FROM district WHERE district_id = '${districtId}';`;
    const distArray = await db.get(getDistQuery);
    response.send(changeWordsCaseDistrict(distArray));
  }
);
//Add District API
app.post("/districts/", authenticationToken, async (request, response) => {
  console.log(request.body);
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `
  INSERT INTO 
   district (district_name,state_id,cases,cured,active,deaths) 
  VALUES 
  (
      '${districtName}', 
      '${stateId}', 
      '${cases}', 
      '${cured}', 
      '${active}', 
      '${deaths}'
  );`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});
//DELETE District API
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistQuery = `DELETE FROM district WHERE district_id='${districtId}';`;
    await db.run(deleteDistQuery);
    response.send("District Removed");
  }
);
app.put(
  "/districts/:districtId",
  authenticationToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistQuery = `
  UPDATE district 
  SET 
   district_name = '${districtName}',
   state_id = '${stateId}',
   cases = '${cases}',
   cured = '${cured}',
   active = '${active}',
   deaths = '${deaths}';`;
    await db.run(updateDistQuery);
    response.send("District Details Updated");
  }
);
//Get states Totals Cases API
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    console.log(stateId);
    const getTotalDataQuery = `
    SELECT 
     sum(district.cases) as totalCases,
     sum(district.cured) as totalCured,
     sum(district.active) as totalActive,
     sum(district.deaths) as totalDeaths
    FROM
      district NATURAL JOIN state
    WHERE 
      state.state_id = '${stateId}';`;
    const data = await db.get(getTotalDataQuery);
    response.send(data);
  }
);

module.exports = app;
