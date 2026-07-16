/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/nortia.json`.
 */
export type Nortia = {
  "address": "4S2EvdGrbKJ9zazvB4gtR83crTrVJWqqwoVVvEQy8VE9",
  "metadata": {
    "name": "nortia",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Private resolver-backed prediction markets on Solana"
  },
  "instructions": [
    {
      "name": "arbitrateOptimisticResolution",
      "discriminator": [
        250,
        54,
        28,
        86,
        11,
        55,
        145,
        104
      ],
      "accounts": [
        {
          "name": "keeper",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocol",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "oracleConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  116,
                  105,
                  109,
                  105,
                  115,
                  116,
                  105,
                  99,
                  45,
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  111,
                  108,
                  117,
                  116,
                  105,
                  111,
                  110,
                  45,
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "arbitrateOptimisticArgs"
            }
          }
        }
      ]
    },
    {
      "name": "beginRefund",
      "discriminator": [
        226,
        174,
        203,
        111,
        10,
        98,
        227,
        156
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.authority",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "buyHybridShares",
      "discriminator": [
        180,
        203,
        173,
        74,
        211,
        54,
        26,
        160
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "treasuryToken",
          "writable": true
        },
        {
          "name": "liquidityToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "tradeSharesArgs"
            }
          }
        }
      ]
    },
    {
      "name": "challengeOptimisticResolution",
      "discriminator": [
        82,
        110,
        174,
        122,
        157,
        235,
        159,
        0
      ],
      "accounts": [
        {
          "name": "challenger",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "oracleConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  116,
                  105,
                  109,
                  105,
                  115,
                  116,
                  105,
                  99,
                  45,
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "bondVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  116,
                  105,
                  109,
                  105,
                  115,
                  116,
                  105,
                  99,
                  45,
                  98,
                  111,
                  110,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "challengerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "challengeOptimisticArgs"
            }
          }
        }
      ]
    },
    {
      "name": "claimOptimisticBond",
      "discriminator": [
        83,
        48,
        193,
        160,
        201,
        132,
        145,
        224
      ],
      "accounts": [
        {
          "name": "claimant",
          "signer": true
        },
        {
          "name": "market",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  116,
                  105,
                  109,
                  105,
                  115,
                  116,
                  105,
                  99,
                  45,
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "bondVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  116,
                  105,
                  109,
                  105,
                  115,
                  116,
                  105,
                  99,
                  45,
                  98,
                  111,
                  110,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "finalizeOptimisticResolution",
      "discriminator": [
        223,
        167,
        182,
        235,
        208,
        131,
        121,
        71
      ],
      "accounts": [
        {
          "name": "keeper",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "oracleConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  116,
                  105,
                  109,
                  105,
                  115,
                  116,
                  105,
                  99,
                  45,
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  111,
                  108,
                  117,
                  116,
                  105,
                  111,
                  110,
                  45,
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeEngine",
      "discriminator": [
        17,
        158,
        153,
        215,
        119,
        242,
        156,
        107
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocol",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "engine",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  103,
                  105,
                  110,
                  101,
                  45,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "initializeEngineArgs"
            }
          }
        }
      ]
    },
    {
      "name": "initializeHybridMarket",
      "discriminator": [
        67,
        244,
        52,
        54,
        119,
        81,
        238,
        108
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "engine",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  103,
                  105,
                  110,
                  101,
                  45,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "creatorToken",
          "writable": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "args.market_id"
              }
            ]
          }
        },
        {
          "name": "oracleConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "initializeHybridMarketArgs"
            }
          }
        }
      ]
    },
    {
      "name": "initializeMarket",
      "discriminator": [
        35,
        35,
        189,
        193,
        155,
        48,
        170,
        203
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "protocol",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "args.market_id"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "initializeMarketArgs"
            }
          }
        }
      ]
    },
    {
      "name": "initializePosition",
      "discriminator": [
        219,
        192,
        234,
        71,
        190,
        191,
        102,
        80
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeProtocol",
      "discriminator": [
        188,
        233,
        252,
        106,
        134,
        146,
        202,
        91
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "address": "5yFHYFS1y8hVuVte6F3ae9NMh3i4F1ZGyTynwb8onb5S"
        },
        {
          "name": "protocol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "collateralMint",
          "address": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "initializeProtocolArgs"
            }
          }
        }
      ]
    },
    {
      "name": "lockHybridMarket",
      "discriminator": [
        124,
        68,
        38,
        83,
        249,
        47,
        68,
        40
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "placeOrder",
      "discriminator": [
        51,
        194,
        155,
        175,
        109,
        130,
        96,
        106
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.authority",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "payerToken",
          "writable": true
        },
        {
          "name": "order",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "arg",
                "path": "args.commitment"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "placementVerifier"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "placeOrderArgs"
            }
          }
        }
      ]
    },
    {
      "name": "proposeOptimisticResolution",
      "discriminator": [
        36,
        175,
        179,
        6,
        18,
        48,
        80,
        15
      ],
      "accounts": [
        {
          "name": "proposer",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "oracleConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  116,
                  105,
                  109,
                  105,
                  115,
                  116,
                  105,
                  99,
                  45,
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "bondVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  116,
                  105,
                  109,
                  105,
                  115,
                  116,
                  105,
                  99,
                  45,
                  98,
                  111,
                  110,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "proposerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "proposeOptimisticArgs"
            }
          }
        }
      ]
    },
    {
      "name": "publishHybridMetadata",
      "discriminator": [
        72,
        93,
        6,
        139,
        229,
        58,
        196,
        206
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "metadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "publishHybridMetadataArgs"
            }
          }
        }
      ]
    },
    {
      "name": "redeem",
      "discriminator": [
        184,
        12,
        86,
        149,
        70,
        196,
        97,
        225
      ],
      "accounts": [
        {
          "name": "relayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.authority",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "claim",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  108,
                  97,
                  105,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "arg",
                "path": "args.nullifier_hash"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "recipientOwner"
        },
        {
          "name": "recipientToken",
          "writable": true
        },
        {
          "name": "redeemVerifier"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "redeemArgs"
            }
          }
        }
      ]
    },
    {
      "name": "refundOrder",
      "discriminator": [
        164,
        168,
        47,
        144,
        154,
        1,
        241,
        255
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.authority",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "order",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "payerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "resolveHybridTimeout",
      "discriminator": [
        15,
        53,
        50,
        20,
        147,
        128,
        130,
        106
      ],
      "accounts": [
        {
          "name": "keeper",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "oracleConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  111,
                  108,
                  117,
                  116,
                  105,
                  111,
                  110,
                  45,
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "resolveHybridWithPyth",
      "discriminator": [
        62,
        94,
        201,
        52,
        232,
        190,
        246,
        42
      ],
      "accounts": [
        {
          "name": "keeper",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "oracleConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  111,
                  108,
                  117,
                  116,
                  105,
                  111,
                  110,
                  45,
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "priceUpdate"
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "resolveHybridWithSwitchboard",
      "discriminator": [
        177,
        248,
        135,
        1,
        141,
        225,
        35,
        243
      ],
      "accounts": [
        {
          "name": "keeper",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "oracleConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  111,
                  108,
                  117,
                  116,
                  105,
                  111,
                  110,
                  45,
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "quoteAccount"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "resolveHybridWithTxline",
      "discriminator": [
        17,
        58,
        89,
        75,
        226,
        93,
        0,
        65
      ],
      "accounts": [
        {
          "name": "keeper",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "oracleConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  111,
                  108,
                  117,
                  116,
                  105,
                  111,
                  110,
                  45,
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "dailyScoresMerkleRoots"
        },
        {
          "name": "txlineProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "payload",
          "type": {
            "defined": {
              "name": "statValidationInput"
            }
          }
        }
      ]
    },
    {
      "name": "resolveMarket",
      "discriminator": [
        155,
        23,
        80,
        173,
        46,
        74,
        23,
        239
      ],
      "accounts": [
        {
          "name": "keeper",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.authority",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "treasuryToken",
          "writable": true
        },
        {
          "name": "keeperToken",
          "writable": true
        },
        {
          "name": "dailyScoresMerkleRoots"
        },
        {
          "name": "txlineProgram"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "finalSeq",
          "type": "u32"
        },
        {
          "name": "payload",
          "type": {
            "defined": {
              "name": "statValidationInput"
            }
          }
        }
      ]
    },
    {
      "name": "sellHybridShares",
      "discriminator": [
        162,
        40,
        8,
        31,
        43,
        165,
        71,
        123
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "treasuryToken",
          "writable": true
        },
        {
          "name": "liquidityToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "tradeSharesArgs"
            }
          }
        }
      ]
    },
    {
      "name": "settleHybridPosition",
      "discriminator": [
        172,
        142,
        89,
        69,
        93,
        139,
        100,
        78
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "submitBatch",
      "discriminator": [
        219,
        171,
        120,
        113,
        27,
        245,
        80,
        20
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.authority",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "submitBatchArgs"
            }
          }
        }
      ]
    },
    {
      "name": "timeoutOptimisticDispute",
      "discriminator": [
        189,
        230,
        9,
        177,
        208,
        106,
        121,
        246
      ],
      "accounts": [
        {
          "name": "keeper",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "oracleConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  112,
                  116,
                  105,
                  109,
                  105,
                  115,
                  116,
                  105,
                  99,
                  45,
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  115,
                  111,
                  108,
                  117,
                  116,
                  105,
                  111,
                  110,
                  45,
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "withdrawHybridLiquidity",
      "discriminator": [
        60,
        223,
        156,
        253,
        141,
        36,
        118,
        225
      ],
      "accounts": [
        {
          "name": "liquidityOwner",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market.creator",
                "account": "hybridMarket"
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "hybridMarket"
              }
            ]
          }
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  121,
                  98,
                  114,
                  105,
                  100,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "liquidityToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "claim",
      "discriminator": [
        155,
        70,
        22,
        176,
        123,
        215,
        246,
        102
      ]
    },
    {
      "name": "engineConfig",
      "discriminator": [
        10,
        197,
        172,
        236,
        51,
        169,
        22,
        207
      ]
    },
    {
      "name": "hybridMarket",
      "discriminator": [
        119,
        255,
        128,
        143,
        154,
        5,
        187,
        160
      ]
    },
    {
      "name": "hybridMarketMetadata",
      "discriminator": [
        149,
        46,
        134,
        223,
        216,
        221,
        165,
        172
      ]
    },
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "optimisticProposal",
      "discriminator": [
        85,
        187,
        185,
        44,
        180,
        224,
        118,
        178
      ]
    },
    {
      "name": "oracleConfig",
      "discriminator": [
        133,
        196,
        152,
        50,
        27,
        21,
        145,
        254
      ]
    },
    {
      "name": "order",
      "discriminator": [
        134,
        173,
        223,
        185,
        77,
        86,
        28,
        51
      ]
    },
    {
      "name": "position",
      "discriminator": [
        170,
        188,
        143,
        228,
        122,
        64,
        247,
        208
      ]
    },
    {
      "name": "protocolConfig",
      "discriminator": [
        207,
        91,
        250,
        28,
        152,
        179,
        215,
        209
      ]
    },
    {
      "name": "resolutionReceipt",
      "discriminator": [
        232,
        39,
        224,
        83,
        211,
        240,
        50,
        217
      ]
    }
  ],
  "events": [
    {
      "name": "batchSubmitted",
      "discriminator": [
        144,
        55,
        16,
        105,
        136,
        253,
        225,
        90
      ]
    },
    {
      "name": "engineInitialized",
      "discriminator": [
        99,
        13,
        48,
        148,
        19,
        233,
        152,
        130
      ]
    },
    {
      "name": "hybridLiquidityWithdrawn",
      "discriminator": [
        216,
        234,
        60,
        189,
        208,
        194,
        186,
        179
      ]
    },
    {
      "name": "hybridMarketCreated",
      "discriminator": [
        174,
        56,
        245,
        229,
        25,
        195,
        89,
        167
      ]
    },
    {
      "name": "hybridMarketLocked",
      "discriminator": [
        183,
        102,
        153,
        91,
        37,
        33,
        156,
        223
      ]
    },
    {
      "name": "hybridMarketResolved",
      "discriminator": [
        102,
        226,
        18,
        169,
        19,
        217,
        232,
        59
      ]
    },
    {
      "name": "hybridMetadataPublished",
      "discriminator": [
        77,
        209,
        165,
        205,
        141,
        177,
        17,
        213
      ]
    },
    {
      "name": "hybridPositionOpened",
      "discriminator": [
        125,
        35,
        98,
        166,
        82,
        28,
        87,
        62
      ]
    },
    {
      "name": "hybridPositionSettled",
      "discriminator": [
        65,
        42,
        188,
        121,
        16,
        102,
        171,
        65
      ]
    },
    {
      "name": "hybridTradeExecuted",
      "discriminator": [
        79,
        55,
        97,
        126,
        148,
        199,
        0,
        60
      ]
    },
    {
      "name": "marketClosed",
      "discriminator": [
        86,
        91,
        119,
        43,
        94,
        0,
        217,
        113
      ]
    },
    {
      "name": "marketCreated",
      "discriminator": [
        88,
        184,
        130,
        231,
        226,
        84,
        6,
        58
      ]
    },
    {
      "name": "marketResolved",
      "discriminator": [
        89,
        67,
        230,
        95,
        143,
        106,
        199,
        202
      ]
    },
    {
      "name": "optimisticBondClaimed",
      "discriminator": [
        104,
        149,
        97,
        54,
        230,
        211,
        59,
        176
      ]
    },
    {
      "name": "optimisticResolutionChallenged",
      "discriminator": [
        160,
        153,
        206,
        181,
        53,
        35,
        12,
        139
      ]
    },
    {
      "name": "optimisticResolutionFinalized",
      "discriminator": [
        227,
        9,
        181,
        196,
        39,
        190,
        204,
        202
      ]
    },
    {
      "name": "optimisticResolutionProposed",
      "discriminator": [
        249,
        207,
        63,
        154,
        222,
        154,
        224,
        191
      ]
    },
    {
      "name": "orderPlaced",
      "discriminator": [
        96,
        130,
        204,
        234,
        169,
        219,
        216,
        227
      ]
    },
    {
      "name": "orderRefunded",
      "discriminator": [
        120,
        155,
        10,
        169,
        7,
        98,
        202,
        187
      ]
    },
    {
      "name": "protocolFeeCollected",
      "discriminator": [
        149,
        0,
        167,
        154,
        105,
        146,
        209,
        134
      ]
    },
    {
      "name": "protocolInitialized",
      "discriminator": [
        173,
        122,
        168,
        254,
        9,
        118,
        76,
        132
      ]
    },
    {
      "name": "refundsOpened",
      "discriminator": [
        60,
        35,
        65,
        41,
        215,
        141,
        201,
        134
      ]
    },
    {
      "name": "winningsRedeemed",
      "discriminator": [
        165,
        63,
        125,
        179,
        230,
        236,
        63,
        99
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidProtocolConfiguration",
      "msg": "Protocol configuration is invalid"
    },
    {
      "code": 6001,
      "name": "invalidMarketConfiguration",
      "msg": "Market configuration is invalid"
    },
    {
      "code": 6002,
      "name": "invalidPhase",
      "msg": "Market phase does not allow this instruction"
    },
    {
      "code": 6003,
      "name": "marketLocked",
      "msg": "The market is locked"
    },
    {
      "code": 6004,
      "name": "tooEarly",
      "msg": "The requested transition is too early"
    },
    {
      "code": 6005,
      "name": "deadlineElapsed",
      "msg": "The deadline has elapsed"
    },
    {
      "code": 6006,
      "name": "committeeQuorumNotMet",
      "msg": "Committee quorum was not met"
    },
    {
      "code": 6007,
      "name": "duplicateCommitteeSigner",
      "msg": "A duplicate committee signer was supplied"
    },
    {
      "code": 6008,
      "name": "batchCountMismatch",
      "msg": "Batch counts do not match accepted orders"
    },
    {
      "code": 6009,
      "name": "noOrders",
      "msg": "The market has no accepted orders"
    },
    {
      "code": 6010,
      "name": "zeroCommitment",
      "msg": "A zero commitment or root is not allowed"
    },
    {
      "code": 6011,
      "name": "invalidWitnessLength",
      "msg": "The public witness has an invalid length"
    },
    {
      "code": 6012,
      "name": "publicWitnessMismatch",
      "msg": "The public witness does not match the instruction context"
    },
    {
      "code": 6013,
      "name": "invalidProofLength",
      "msg": "The proof payload has an invalid length"
    },
    {
      "code": 6014,
      "name": "invalidVerifierProgram",
      "msg": "The verifier program is invalid"
    },
    {
      "code": 6015,
      "name": "poseidonHashFailed",
      "msg": "Poseidon hashing failed"
    },
    {
      "code": 6016,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6017,
      "name": "noWinners",
      "msg": "The resolved side has no winning tickets"
    },
    {
      "code": 6018,
      "name": "alreadyRefunded",
      "msg": "The order has already been refunded"
    },
    {
      "code": 6019,
      "name": "invalidOrder",
      "msg": "The order does not belong to this market or payer"
    },
    {
      "code": 6020,
      "name": "invalidCollateralMint",
      "msg": "The collateral mint is invalid"
    },
    {
      "code": 6021,
      "name": "invalidTokenAccount",
      "msg": "A token account does not match the required owner or mint"
    },
    {
      "code": 6022,
      "name": "invalidProtocolFee",
      "msg": "The protocol fee is invalid"
    },
    {
      "code": 6023,
      "name": "invalidTreasury",
      "msg": "The protocol treasury is invalid"
    },
    {
      "code": 6024,
      "name": "insufficientVaultBalance",
      "msg": "The vault does not have enough ticket collateral"
    },
    {
      "code": 6025,
      "name": "invalidTxlineProgram",
      "msg": "The TxLINE program is invalid"
    },
    {
      "code": 6026,
      "name": "invalidTxlineRoot",
      "msg": "The TxLINE daily root account is invalid"
    },
    {
      "code": 6027,
      "name": "invalidScorePayload",
      "msg": "The TxLINE score payload is invalid for this market"
    },
    {
      "code": 6028,
      "name": "invalidTxlineReturn",
      "msg": "TxLINE did not return a valid boolean"
    },
    {
      "code": 6029,
      "name": "invalidEngineConfiguration",
      "msg": "The V2 engine configuration is invalid"
    },
    {
      "code": 6030,
      "name": "invalidLmsrState",
      "msg": "The LMSR quote or market state is outside protocol bounds"
    },
    {
      "code": 6031,
      "name": "priceGuardExceeded",
      "msg": "The trade price guard was exceeded"
    },
    {
      "code": 6032,
      "name": "tradeDeadlineElapsed",
      "msg": "The trade deadline has elapsed"
    },
    {
      "code": 6033,
      "name": "invalidPosition",
      "msg": "The position is invalid for this owner or market"
    },
    {
      "code": 6034,
      "name": "insufficientPosition",
      "msg": "The position does not have enough outcome shares"
    },
    {
      "code": 6035,
      "name": "insolventMarket",
      "msg": "The market vault would become undercollateralized"
    },
    {
      "code": 6036,
      "name": "invalidOracleConfiguration",
      "msg": "The oracle configuration is invalid for this market"
    },
    {
      "code": 6037,
      "name": "resolverNotEnabled",
      "msg": "The configured resolver is not enabled"
    },
    {
      "code": 6038,
      "name": "invalidObservationTime",
      "msg": "The resolution evidence is stale, early, or outside the observation window"
    },
    {
      "code": 6039,
      "name": "resolutionReplay",
      "msg": "The oracle evidence has already been consumed"
    },
    {
      "code": 6040,
      "name": "invalidOutcome",
      "msg": "The market outcome is invalid"
    },
    {
      "code": 6041,
      "name": "positionAlreadySettled",
      "msg": "The position was already settled"
    },
    {
      "code": 6042,
      "name": "marketNotReadyForResolution",
      "msg": "The market is not ready for resolution"
    },
    {
      "code": 6043,
      "name": "invalidSwitchboardQuote",
      "msg": "The Switchboard quote account or payload is invalid"
    },
    {
      "code": 6044,
      "name": "invalidAssertion",
      "msg": "The optimistic assertion or challenge is invalid"
    },
    {
      "code": 6045,
      "name": "challengeWindowClosed",
      "msg": "The optimistic challenge window is closed"
    },
    {
      "code": 6046,
      "name": "invalidDisputeDecision",
      "msg": "The optimistic dispute decision is invalid"
    },
    {
      "code": 6047,
      "name": "resolverSecurityCapExceeded",
      "msg": "The trade would exceed the resolver security cap"
    },
    {
      "code": 6048,
      "name": "noOptimisticBondPayout",
      "msg": "No optimistic bond payout is available for this claimant"
    },
    {
      "code": 6049,
      "name": "invalidMarketMetadata",
      "msg": "The published market metadata does not match its immutable hashes"
    }
  ],
  "types": [
    {
      "name": "arbitrateOptimisticArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "decisionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "batchSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "commitmentRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "yesCount",
            "type": "u32"
          },
          {
            "name": "noCount",
            "type": "u32"
          },
          {
            "name": "refunding",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "challengeOptimisticArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "challengeHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "claim",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "nullifierHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "recipientOwner",
            "type": "pubkey"
          },
          {
            "name": "recipientToken",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "engineConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasuryOwner",
            "type": "pubkey"
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "tokenProgram",
            "type": "pubkey"
          },
          {
            "name": "treasuryFeeShareBps",
            "type": "u16"
          },
          {
            "name": "pythReceiverProgram",
            "type": "pubkey"
          },
          {
            "name": "switchboardQuoteProgram",
            "type": "pubkey"
          },
          {
            "name": "paused",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "engineInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "engine",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasuryOwner",
            "type": "pubkey"
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "treasuryFeeShareBps",
            "type": "u16"
          },
          {
            "name": "pythReceiverProgram",
            "type": "pubkey"
          },
          {
            "name": "switchboardQuoteProgram",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "hybridLiquidityWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "liquidityOwner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "outstandingLiability",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "hybridMarket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          },
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "liquidityOwner",
            "type": "pubkey"
          },
          {
            "name": "category",
            "type": {
              "defined": {
                "name": "marketCategory"
              }
            }
          },
          {
            "name": "tradingMode",
            "type": {
              "defined": {
                "name": "hybridTradingMode"
              }
            }
          },
          {
            "name": "pricingModel",
            "type": {
              "defined": {
                "name": "hybridPricingModel"
              }
            }
          },
          {
            "name": "questionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "rulesHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "outcomeLabelsHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "tokenProgram",
            "type": "pubkey"
          },
          {
            "name": "treasuryOwner",
            "type": "pubkey"
          },
          {
            "name": "oracleConfig",
            "type": "pubkey"
          },
          {
            "name": "liquidityParameter",
            "type": "u64"
          },
          {
            "name": "initialSubsidy",
            "type": "u64"
          },
          {
            "name": "roundingReserve",
            "type": "u64"
          },
          {
            "name": "maxTradeShares",
            "type": "u64"
          },
          {
            "name": "resolverSecurityCap",
            "type": "u64"
          },
          {
            "name": "yesQuantity",
            "type": "u64"
          },
          {
            "name": "noQuantity",
            "type": "u64"
          },
          {
            "name": "tradeFeeBps",
            "type": "u16"
          },
          {
            "name": "treasuryFeeShareBps",
            "type": "u16"
          },
          {
            "name": "openTs",
            "type": "i64"
          },
          {
            "name": "lockTs",
            "type": "i64"
          },
          {
            "name": "resolveNotBeforeTs",
            "type": "i64"
          },
          {
            "name": "resolutionDeadlineTs",
            "type": "i64"
          },
          {
            "name": "phase",
            "type": {
              "defined": {
                "name": "hybridPhase"
              }
            }
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "tradeCount",
            "type": "u64"
          },
          {
            "name": "volume",
            "type": "u64"
          },
          {
            "name": "treasuryFees",
            "type": "u64"
          },
          {
            "name": "liquidityFees",
            "type": "u64"
          },
          {
            "name": "outstandingLiability",
            "type": "u64"
          },
          {
            "name": "redeemedLiability",
            "type": "u64"
          },
          {
            "name": "settledAt",
            "type": "i64"
          },
          {
            "name": "settlementEvidenceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "hybridMarketCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "category",
            "type": {
              "defined": {
                "name": "marketCategory"
              }
            }
          },
          {
            "name": "resolver",
            "type": {
              "defined": {
                "name": "oracleResolverV2"
              }
            }
          },
          {
            "name": "liquidityParameter",
            "type": "u64"
          },
          {
            "name": "initialSubsidy",
            "type": "u64"
          },
          {
            "name": "tradeFeeBps",
            "type": "u16"
          },
          {
            "name": "resolverSecurityCap",
            "type": "u64"
          },
          {
            "name": "lockTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "hybridMarketLocked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "lockedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "hybridMarketMetadata",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "question",
            "type": "string"
          },
          {
            "name": "rules",
            "type": "string"
          },
          {
            "name": "yesLabel",
            "type": "string"
          },
          {
            "name": "noLabel",
            "type": "string"
          },
          {
            "name": "referenceUrl",
            "type": "string"
          },
          {
            "name": "publishedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "hybridMarketResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "resolver",
            "type": {
              "defined": {
                "name": "oracleResolverV2"
              }
            }
          },
          {
            "name": "outstandingLiability",
            "type": "u64"
          },
          {
            "name": "evidenceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "settledAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "hybridMetadataPublished",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "metadata",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "publishedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "hybridPhase",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "locked"
          },
          {
            "name": "resolving"
          },
          {
            "name": "disputed"
          },
          {
            "name": "resolved"
          },
          {
            "name": "closed"
          }
        ]
      }
    },
    {
      "name": "hybridPositionOpened",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "position",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "hybridPositionSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "position",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "hybridPricingModel",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "lmsr"
          }
        ]
      }
    },
    {
      "name": "hybridTradeExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "position",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "direction",
            "type": "u8"
          },
          {
            "name": "side",
            "type": "u8"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "rawAmount",
            "type": "u64"
          },
          {
            "name": "feeAmount",
            "type": "u64"
          },
          {
            "name": "totalAmount",
            "type": "u64"
          },
          {
            "name": "beforeYesProbability",
            "type": "u64"
          },
          {
            "name": "afterYesProbability",
            "type": "u64"
          },
          {
            "name": "yesQuantity",
            "type": "u64"
          },
          {
            "name": "noQuantity",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "hybridTradingMode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "continuous"
          },
          {
            "name": "privateBatch"
          }
        ]
      }
    },
    {
      "name": "initializeEngineArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "treasuryFeeShareBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "initializeHybridMarketArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "category",
            "type": {
              "defined": {
                "name": "marketCategory"
              }
            }
          },
          {
            "name": "tradingMode",
            "type": {
              "defined": {
                "name": "hybridTradingMode"
              }
            }
          },
          {
            "name": "questionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "rulesHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "outcomeLabelsHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "liquidityParameter",
            "type": "u64"
          },
          {
            "name": "roundingReserve",
            "type": "u64"
          },
          {
            "name": "maxTradeShares",
            "type": "u64"
          },
          {
            "name": "tradeFeeBps",
            "type": "u16"
          },
          {
            "name": "lockTs",
            "type": "i64"
          },
          {
            "name": "resolveNotBeforeTs",
            "type": "i64"
          },
          {
            "name": "resolutionDeadlineTs",
            "type": "i64"
          },
          {
            "name": "oracle",
            "type": {
              "defined": {
                "name": "oracleConfigArgs"
              }
            }
          }
        ]
      }
    },
    {
      "name": "initializeMarketArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "category",
            "type": {
              "defined": {
                "name": "marketCategory"
              }
            }
          },
          {
            "name": "resolverKind",
            "type": {
              "defined": {
                "name": "resolverKind"
              }
            }
          },
          {
            "name": "questionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "rulesHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "totalGoalsThreshold",
            "type": "i32"
          },
          {
            "name": "marketMode",
            "type": {
              "defined": {
                "name": "marketMode"
              }
            }
          },
          {
            "name": "fixtureStartTs",
            "type": "i64"
          },
          {
            "name": "lockTs",
            "type": "i64"
          },
          {
            "name": "batchDeadlineTs",
            "type": "i64"
          },
          {
            "name": "resolutionDeadlineTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "initializeProtocolArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "treasuryOwner",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "keeperRewardBps",
            "type": "u16"
          },
          {
            "name": "committee",
            "type": {
              "array": [
                "pubkey",
                3
              ]
            }
          },
          {
            "name": "placementVerifier",
            "type": "pubkey"
          },
          {
            "name": "redeemVerifier",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          },
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "category",
            "type": {
              "defined": {
                "name": "marketCategory"
              }
            }
          },
          {
            "name": "resolverKind",
            "type": {
              "defined": {
                "name": "resolverKind"
              }
            }
          },
          {
            "name": "questionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "rulesHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "marketMode",
            "type": {
              "defined": {
                "name": "marketMode"
              }
            }
          },
          {
            "name": "fixtureStartTs",
            "type": "i64"
          },
          {
            "name": "scoreKeyA",
            "type": "u32"
          },
          {
            "name": "scoreKeyB",
            "type": "u32"
          },
          {
            "name": "totalGoalsThreshold",
            "type": "i32"
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "tokenProgram",
            "type": "pubkey"
          },
          {
            "name": "ticketAmount",
            "type": "u64"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "keeperRewardBps",
            "type": "u16"
          },
          {
            "name": "treasuryOwner",
            "type": "pubkey"
          },
          {
            "name": "txlineProgram",
            "type": "pubkey"
          },
          {
            "name": "lockTs",
            "type": "i64"
          },
          {
            "name": "batchDeadlineTs",
            "type": "i64"
          },
          {
            "name": "resolutionDeadlineTs",
            "type": "i64"
          },
          {
            "name": "phase",
            "type": {
              "defined": {
                "name": "marketPhase"
              }
            }
          },
          {
            "name": "orderCount",
            "type": "u32"
          },
          {
            "name": "yesCount",
            "type": "u32"
          },
          {
            "name": "noCount",
            "type": "u32"
          },
          {
            "name": "commitmentRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "committee",
            "type": {
              "array": [
                "pubkey",
                3
              ]
            }
          },
          {
            "name": "placementVerifier",
            "type": "pubkey"
          },
          {
            "name": "redeemVerifier",
            "type": "pubkey"
          },
          {
            "name": "grossPool",
            "type": "u64"
          },
          {
            "name": "protocolFee",
            "type": "u64"
          },
          {
            "name": "keeperReward",
            "type": "u64"
          },
          {
            "name": "treasuryFee",
            "type": "u64"
          },
          {
            "name": "netPool",
            "type": "u64"
          },
          {
            "name": "payoutAmount",
            "type": "u64"
          },
          {
            "name": "payoutRemainder",
            "type": "u64"
          },
          {
            "name": "claimedCount",
            "type": "u32"
          },
          {
            "name": "refundedCount",
            "type": "u32"
          },
          {
            "name": "settledAt",
            "type": "i64"
          },
          {
            "name": "txlineProofTs",
            "type": "i64"
          },
          {
            "name": "finalSeq",
            "type": "u32"
          },
          {
            "name": "dailyScoresRoot",
            "type": "pubkey"
          },
          {
            "name": "settlementEvidenceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "scoreA",
            "type": "i32"
          },
          {
            "name": "scoreB",
            "type": "i32"
          }
        ]
      }
    },
    {
      "name": "marketCategory",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "sports"
          },
          {
            "name": "crypto"
          },
          {
            "name": "politics"
          },
          {
            "name": "technology"
          },
          {
            "name": "culture"
          },
          {
            "name": "other"
          }
        ]
      }
    },
    {
      "name": "marketClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "marketCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "category",
            "type": {
              "defined": {
                "name": "marketCategory"
              }
            }
          },
          {
            "name": "resolverKind",
            "type": {
              "defined": {
                "name": "resolverKind"
              }
            }
          },
          {
            "name": "questionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "rulesHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "totalGoalsThreshold",
            "type": "i32"
          },
          {
            "name": "marketMode",
            "type": {
              "defined": {
                "name": "marketMode"
              }
            }
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "ticketAmount",
            "type": "u64"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "lockTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketMode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "live"
          },
          {
            "name": "replay"
          }
        ]
      }
    },
    {
      "name": "marketPhase",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "batched"
          },
          {
            "name": "resolved"
          },
          {
            "name": "refunding"
          },
          {
            "name": "closed"
          }
        ]
      }
    },
    {
      "name": "marketResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "scoreA",
            "type": "i32"
          },
          {
            "name": "scoreB",
            "type": "i32"
          },
          {
            "name": "grossPool",
            "type": "u64"
          },
          {
            "name": "protocolFee",
            "type": "u64"
          },
          {
            "name": "keeperReward",
            "type": "u64"
          },
          {
            "name": "treasuryFee",
            "type": "u64"
          },
          {
            "name": "netPool",
            "type": "u64"
          },
          {
            "name": "payoutAmount",
            "type": "u64"
          },
          {
            "name": "payoutRemainder",
            "type": "u64"
          },
          {
            "name": "settlementEvidenceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "optimisticBondClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "proposal",
            "type": "pubkey"
          },
          {
            "name": "claimant",
            "type": "pubkey"
          },
          {
            "name": "destination",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "optimisticProposal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "bondVaultBump",
            "type": "u8"
          },
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "proposer",
            "type": "pubkey"
          },
          {
            "name": "proposerToken",
            "type": "pubkey"
          },
          {
            "name": "proposedOutcome",
            "type": "u8"
          },
          {
            "name": "assertionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "proposedAt",
            "type": "i64"
          },
          {
            "name": "challengeDeadline",
            "type": "i64"
          },
          {
            "name": "challenger",
            "type": "pubkey"
          },
          {
            "name": "challengerToken",
            "type": "pubkey"
          },
          {
            "name": "challengedOutcome",
            "type": "u8"
          },
          {
            "name": "challengeHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "challengedAt",
            "type": "i64"
          },
          {
            "name": "bondAmount",
            "type": "u64"
          },
          {
            "name": "proposerPayout",
            "type": "u64"
          },
          {
            "name": "challengerPayout",
            "type": "u64"
          },
          {
            "name": "treasuryPayout",
            "type": "u64"
          },
          {
            "name": "proposerClaimed",
            "type": "bool"
          },
          {
            "name": "challengerClaimed",
            "type": "bool"
          },
          {
            "name": "treasuryClaimed",
            "type": "bool"
          },
          {
            "name": "finalized",
            "type": "bool"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "decisionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "optimisticResolutionChallenged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "proposal",
            "type": "pubkey"
          },
          {
            "name": "challenger",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "challengeHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bondAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "optimisticResolutionFinalized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "proposal",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "winnerPayout",
            "type": "u64"
          },
          {
            "name": "treasuryFee",
            "type": "u64"
          },
          {
            "name": "decisionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "invalidRefund",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "optimisticResolutionProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "proposal",
            "type": "pubkey"
          },
          {
            "name": "proposer",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "assertionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bondAmount",
            "type": "u64"
          },
          {
            "name": "challengeDeadline",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "oracleConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "resolver",
            "type": {
              "defined": {
                "name": "oracleResolverV2"
              }
            }
          },
          {
            "name": "sourceProgram",
            "type": "pubkey"
          },
          {
            "name": "sourceQueue",
            "type": "pubkey"
          },
          {
            "name": "sourceId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "comparator",
            "type": {
              "defined": {
                "name": "valueComparator"
              }
            }
          },
          {
            "name": "threshold",
            "type": "i128"
          },
          {
            "name": "thresholdExponent",
            "type": "i32"
          },
          {
            "name": "observationTs",
            "type": "i64"
          },
          {
            "name": "observationWindowSecs",
            "type": "u32"
          },
          {
            "name": "maxStalenessSecs",
            "type": "u32"
          },
          {
            "name": "maxStalenessSlots",
            "type": "u64"
          },
          {
            "name": "maxConfidenceBps",
            "type": "u16"
          },
          {
            "name": "minSamples",
            "type": "u8"
          },
          {
            "name": "challengePeriodSecs",
            "type": "u32"
          },
          {
            "name": "bondAmount",
            "type": "u64"
          },
          {
            "name": "configHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "optimisticProposal",
            "type": "pubkey"
          },
          {
            "name": "consumed",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "oracleConfigArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "resolver",
            "type": {
              "defined": {
                "name": "oracleResolverV2"
              }
            }
          },
          {
            "name": "sourceProgram",
            "type": "pubkey"
          },
          {
            "name": "sourceQueue",
            "type": "pubkey"
          },
          {
            "name": "sourceId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "comparator",
            "type": {
              "defined": {
                "name": "valueComparator"
              }
            }
          },
          {
            "name": "threshold",
            "type": "i128"
          },
          {
            "name": "thresholdExponent",
            "type": "i32"
          },
          {
            "name": "observationTs",
            "type": "i64"
          },
          {
            "name": "observationWindowSecs",
            "type": "u32"
          },
          {
            "name": "maxStalenessSecs",
            "type": "u32"
          },
          {
            "name": "maxStalenessSlots",
            "type": "u64"
          },
          {
            "name": "maxConfidenceBps",
            "type": "u16"
          },
          {
            "name": "minSamples",
            "type": "u8"
          },
          {
            "name": "challengePeriodSecs",
            "type": "u32"
          },
          {
            "name": "bondAmount",
            "type": "u64"
          },
          {
            "name": "configHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "oracleResolverV2",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "txlineStatV2"
          },
          {
            "name": "pythPriceV2"
          },
          {
            "name": "switchboardQuoteV1"
          },
          {
            "name": "optimisticV1"
          },
          {
            "name": "umaWormholeV1"
          },
          {
            "name": "chainlinkReportV1"
          }
        ]
      }
    },
    {
      "name": "order",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "orderIndex",
            "type": "u32"
          },
          {
            "name": "commitment",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "shareCommitments",
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                3
              ]
            }
          },
          {
            "name": "refunded",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "orderPlaced",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "order",
            "type": "pubkey"
          },
          {
            "name": "orderIndex",
            "type": "u32"
          },
          {
            "name": "commitment",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "orderCount",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "orderRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "order",
            "type": "pubkey"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "placeOrderArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "commitment",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "shareCommitments",
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                3
              ]
            }
          },
          {
            "name": "proof",
            "type": "bytes"
          },
          {
            "name": "publicWitness",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "position",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "yesShares",
            "type": "u64"
          },
          {
            "name": "noShares",
            "type": "u64"
          },
          {
            "name": "totalSpent",
            "type": "u64"
          },
          {
            "name": "totalProceeds",
            "type": "u64"
          },
          {
            "name": "settledAmount",
            "type": "u64"
          },
          {
            "name": "settled",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "priceFeedMessage",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedId",
            "docs": [
              "`FeedId` but avoid the type alias because of compatibility issues with Anchor's `idl-build` feature."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "conf",
            "type": "u64"
          },
          {
            "name": "exponent",
            "type": "i32"
          },
          {
            "name": "publishTime",
            "docs": [
              "The timestamp of this price update in seconds"
            ],
            "type": "i64"
          },
          {
            "name": "prevPublishTime",
            "docs": [
              "The timestamp of the previous price update. This field is intended to allow users to",
              "identify the single unique price update for any moment in time:",
              "for any time t, the unique update is the one such that prev_publish_time < t <= publish_time.",
              "",
              "Note that there may not be such an update while we are migrating to the new message-sending logic,",
              "as some price updates on pythnet may not be sent to other chains (because the message-sending",
              "logic may not have triggered). We can solve this problem by making the message-sending mandatory",
              "(which we can do once publishers have migrated over).",
              "",
              "Additionally, this field may be equal to publish_time if the message is sent on a slot where",
              "where the aggregation was unsuccesful. This problem will go away once all publishers have",
              "migrated over to a recent version of pyth-agent."
            ],
            "type": "i64"
          },
          {
            "name": "emaPrice",
            "type": "i64"
          },
          {
            "name": "emaConf",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "priceUpdateV2",
      "docs": [
        "A price update account. This account is used by the Pyth Receiver program to store a verified price update from a Pyth price feed.",
        "It contains:",
        "- `write_authority`: The write authority for this account. This authority can close this account to reclaim rent or update the account to contain a different price update.",
        "- `verification_level`: The [`VerificationLevel`] of this price update. This represents how many Wormhole guardian signatures have been verified for this price update.",
        "- `price_message`: The actual price update.",
        "- `posted_slot`: The slot at which this price update was posted."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "writeAuthority",
            "type": "pubkey"
          },
          {
            "name": "verificationLevel",
            "type": {
              "defined": {
                "name": "verificationLevel"
              }
            }
          },
          {
            "name": "priceMessage",
            "type": {
              "defined": {
                "name": "priceFeedMessage"
              }
            }
          },
          {
            "name": "postedSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "proofNode",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "isRightSibling",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "proposeOptimisticArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "assertionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "protocolConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasuryOwner",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "keeperRewardBps",
            "type": "u16"
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "tokenProgram",
            "type": "pubkey"
          },
          {
            "name": "txlineProgram",
            "type": "pubkey"
          },
          {
            "name": "committee",
            "type": {
              "array": [
                "pubkey",
                3
              ]
            }
          },
          {
            "name": "placementVerifier",
            "type": "pubkey"
          },
          {
            "name": "redeemVerifier",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "protocolFeeCollected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "treasuryOwner",
            "type": "pubkey"
          },
          {
            "name": "treasuryToken",
            "type": "pubkey"
          },
          {
            "name": "grossPool",
            "type": "u64"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "treasuryAmount",
            "type": "u64"
          },
          {
            "name": "keeper",
            "type": "pubkey"
          },
          {
            "name": "keeperAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "protocolInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "protocol",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasuryOwner",
            "type": "pubkey"
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "keeperRewardBps",
            "type": "u16"
          },
          {
            "name": "committee",
            "type": {
              "array": [
                "pubkey",
                3
              ]
            }
          },
          {
            "name": "placementVerifier",
            "type": "pubkey"
          },
          {
            "name": "redeemVerifier",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "publishHybridMetadataArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "question",
            "type": "string"
          },
          {
            "name": "rules",
            "type": "string"
          },
          {
            "name": "yesLabel",
            "type": "string"
          },
          {
            "name": "noLabel",
            "type": "string"
          },
          {
            "name": "referenceUrl",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "redeemArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nullifierHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "proof",
            "type": "bytes"
          },
          {
            "name": "publicWitness",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "refundsOpened",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "resolutionReceipt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "resolver",
            "type": {
              "defined": {
                "name": "oracleResolverV2"
              }
            }
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "observationValue",
            "type": "i128"
          },
          {
            "name": "observationExponent",
            "type": "i32"
          },
          {
            "name": "observationTs",
            "type": "i64"
          },
          {
            "name": "observationSlot",
            "type": "u64"
          },
          {
            "name": "confidence",
            "type": "u64"
          },
          {
            "name": "sampleCount",
            "type": "u8"
          },
          {
            "name": "sourceQueue",
            "type": "pubkey"
          },
          {
            "name": "sourceId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "sourceAccount",
            "type": "pubkey"
          },
          {
            "name": "evidenceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "finalizedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "resolverKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "txlineStatV2"
          }
        ]
      }
    },
    {
      "name": "scoreStat",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "key",
            "type": "u32"
          },
          {
            "name": "value",
            "type": "i32"
          },
          {
            "name": "period",
            "type": "i32"
          }
        ]
      }
    },
    {
      "name": "scoresBatchSummary",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "updateStats",
            "type": {
              "defined": {
                "name": "scoresUpdateStats"
              }
            }
          },
          {
            "name": "eventsSubTreeRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "scoresUpdateStats",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "updateCount",
            "type": "i32"
          },
          {
            "name": "minTimestamp",
            "type": "i64"
          },
          {
            "name": "maxTimestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "statLeaf",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stat",
            "type": {
              "defined": {
                "name": "scoreStat"
              }
            }
          },
          {
            "name": "statProof",
            "type": {
              "vec": {
                "defined": {
                  "name": "proofNode"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "statValidationInput",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ts",
            "type": "i64"
          },
          {
            "name": "fixtureSummary",
            "type": {
              "defined": {
                "name": "scoresBatchSummary"
              }
            }
          },
          {
            "name": "fixtureProof",
            "type": {
              "vec": {
                "defined": {
                  "name": "proofNode"
                }
              }
            }
          },
          {
            "name": "mainTreeProof",
            "type": {
              "vec": {
                "defined": {
                  "name": "proofNode"
                }
              }
            }
          },
          {
            "name": "eventStatRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "stats",
            "type": {
              "vec": {
                "defined": {
                  "name": "statLeaf"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "submitBatchArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "commitmentRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "yesCount",
            "type": "u32"
          },
          {
            "name": "noCount",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "tradeSharesArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "side",
            "type": "u8"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "amountGuard",
            "type": "u64"
          },
          {
            "name": "deadlineTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "valueComparator",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "greaterThan"
          },
          {
            "name": "greaterThanOrEqual"
          },
          {
            "name": "lessThan"
          },
          {
            "name": "lessThanOrEqual"
          },
          {
            "name": "equal"
          }
        ]
      }
    },
    {
      "name": "verificationLevel",
      "docs": [
        "Pyth price updates are bridged to all blockchains via Wormhole.",
        "Using the price updates on another chain requires verifying the signatures of the Wormhole guardians.",
        "The usual process is to check the signatures for two thirds of the total number of guardians, but this can be cumbersome on Solana because of the transaction size limits,",
        "so we also allow for partial verification.",
        "",
        "This enum represents how much a price update has been verified:",
        "- If `Full`, we have verified the signatures for two thirds of the current guardians.",
        "- If `Partial`, only `num_signatures` guardian signatures have been checked.",
        "",
        "# Warning",
        "Using partially verified price updates is dangerous, as it lowers the threshold of guardians that need to collude to produce a malicious price update."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "partial",
            "fields": [
              {
                "name": "numSignatures",
                "type": "u8"
              }
            ]
          },
          {
            "name": "full"
          }
        ]
      }
    },
    {
      "name": "winningsRedeemed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "nullifierHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "recipientOwner",
            "type": "pubkey"
          },
          {
            "name": "recipientToken",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
