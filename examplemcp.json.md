    "harvest": {
      "type": "stdio",
      "command": "node",
      "args": [
        "path\\to\\repo\\HarvestMCP\\build\\index.js"
      ],
      "env": {
        "HARVEST_ACCOUNT_ID": "${env:Harvest_ID}",
        "HARVEST_ACCESS_TOKEN": "${env:Harvest_Token}"
      }
    }
