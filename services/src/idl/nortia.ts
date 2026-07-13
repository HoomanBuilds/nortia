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
          "signer": true
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
          "name": "collateralMint"
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
    }
  ],
  "types": [
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
