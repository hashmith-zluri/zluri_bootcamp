const { query } = require("../config/db");

const dbController = {
  getDbTypes: (req, res) => {
    res.status(200).json({ success: true, types: ["POSTGRES", "MONGO"] });
  },

  getDbInstances: async (req, res) => {
    const { type } = req.query;
    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Type parameter is required",
      });
    }
    try {
      const result = await query("SELECT id, name FROM db_instances WHERE engine = $1 ORDER BY name", [type.toUpperCase()]);
      res.status(200).json({
        success: true,
        instances: result.rows.map(row => ({ id: String(row.id), name: row.name }))
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  getDatabasesByInstance: async (req, res) => {
    const { id } = req.params;
    try {
      // Get the instance details from our portal database
      const instanceResult = await query(
        "SELECT name, host, port, engine FROM db_instances WHERE id = $1", 
        [id]
      );
      
      if (instanceResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Instance not found" 
        });
      }

      const instance = instanceResult.rows[0];
      
      if (instance.engine === "POSTGRES") {
        // Get databases for this PostgreSQL instance from instance_databases table
        const dbResult = await query(
          'SELECT database_name FROM instance_databases WHERE instance_id = $1 ORDER BY database_name',
          [id]
        );
        
        const databases = dbResult.rows.map(row => row.database_name);
        res.status(200).json({ success: true, databases });
        
      } else if (instance.engine === "MONGO") {
        // Get databases for this MongoDB instance from instance_databases table
        const dbResult = await query(
          'SELECT database_name FROM instance_databases WHERE instance_id = $1 ORDER BY database_name',
          [id]
        );
        
        const databases = dbResult.rows.map(row => row.database_name);
        res.status(200).json({ success: true, databases });
        
      } else {
        res.status(400).json({ 
          success: false, 
          message: `Unsupported database engine: ${instance.engine}` 
        });
      }
    } catch (error) {
      console.error("Get databases by instance failed:", error.message);
      res.status(500).json({ 
        success: false, 
        message: "Failed to fetch databases" 
      });
    }
  }
};

module.exports = dbController;
