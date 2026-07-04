// The interactive first-game tutorial scenario: an original walkthrough of
// Annie vs Garen (the two starter legends) written for TFT Clash against the
// official Core Rules. Rendered by TutorialSection.jsx. All card names
// resolve against the card database; combat math and rune economy verified
// (including the Accelerate surcharge paid for Jinx in s12).
export var SCENARIO = {
  "title": "Playing With Fire: Your First Riftbound Match",
  "intro": "Pull up a chair. In this walkthrough you pilot Annie, the Dark Child, against Garen, the Might of Demacia, through the first three turns of a real match. Every step teaches exactly one idea, every board is exactly what you would see at the table, and by the end you will know how games are actually won.",
  "you": {
    "legend": "Annie - Dark Child",
    "champion": "Annie - Fiery"
  },
  "opp": {
    "legend": "Garen - Might of Demacia",
    "champion": "Garen - Rugged"
  },
  "battlefields": [
    "Back-Alley Bar",
    "Grove of the God-Willow"
  ],
  "steps": [
    {
      "id": "s1",
      "turn": 1,
      "phase": "Beginning",
      "title": "Meet Your Legend",
      "text": "Welcome to your first clash. You are running Annie with Fury and Chaos runes, all speed and flame, while Garen sits across from you with sturdy Body and Order forces. You each drew four cards, and if up to two of them looked ugly you could have set them aside and redrawn, with the castoffs recycled to the bottom of your deck. Two battlefields wait between you: the Back-Alley Bar and the Grove of the God-Willow.",
      "cards": [],
      "board": {
        "you": {
          "runes": 0,
          "points": 0,
          "base": [],
          "bf1": [],
          "bf2": []
        },
        "opp": {
          "runes": 0,
          "points": 0,
          "base": [],
          "bf1": [],
          "bf2": []
        }
      }
    },
    {
      "id": "s2",
      "turn": 1,
      "phase": "Channel",
      "title": "Channel Your Runes",
      "text": "Every turn opens with the same ritual: Awaken readies everything you control, the Beginning Phase checks what you are holding, and then you Channel the top two runes of your rune deck onto the board. This time a Fury Rune and a Chaos Rune land. These stones are your entire economy, and they grow by two every single turn, so your plays get bigger fast.",
      "cards": [
        "Fury Rune",
        "Chaos Rune"
      ],
      "board": {
        "you": {
          "runes": 2,
          "points": 0,
          "base": [],
          "bf1": [],
          "bf2": []
        },
        "opp": {
          "runes": 0,
          "points": 0,
          "base": [],
          "bf1": [],
          "bf2": []
        }
      }
    },
    {
      "id": "s3",
      "turn": 1,
      "phase": "Main",
      "title": "Energy or Power?",
      "text": "Runes pay for everything, in two very different ways. Exhaust a rune, turning it sideways, and it makes 1 Energy while staying right where it is. Recycle a rune to the bottom of your rune deck and it makes 1 Power of its domain, but it leaves the board for a while. On a card's cost, the big numeral wants Energy and the domain symbols want Power.",
      "cards": [
        "Chemtech Enforcer"
      ],
      "choice": {
        "prompt": "Chemtech Enforcer costs 2 Energy. What is the cheapest way to pay for it?",
        "options": [
          {
            "label": "Exhaust both of my runes",
            "correct": true,
            "response": "Exactly right. Exhausted runes stay on the board and wake back up next turn, so your economy keeps compounding."
          },
          {
            "label": "Recycle both of my runes",
            "correct": false,
            "response": "Careful, recycling makes Power, not Energy, and those runes would leave the board. Save recycling for costs with domain symbols on them."
          },
          {
            "label": "Exhaust just one rune",
            "correct": false,
            "response": "Good instinct to spend light, but one rune only makes 1 Energy and the Enforcer needs 2. Turn both sideways."
          }
        ]
      },
      "board": {
        "you": {
          "runes": 2,
          "points": 0,
          "base": [],
          "bf1": [],
          "bf2": []
        },
        "opp": {
          "runes": 0,
          "points": 0,
          "base": [],
          "bf1": [],
          "bf2": []
        }
      }
    },
    {
      "id": "s4",
      "turn": 1,
      "phase": "Main",
      "title": "Deploy the Enforcer",
      "text": "Exhaust both runes for 2 Energy and put Chemtech Enforcer into play, a 2 might bruiser with Assault 2. Its arrival ability makes you discard a card, a fair tax for muscle this early. Notice that it lands at your base already exhausted, so it cannot march anywhere this turn. Fresh recruits almost always need a turn to catch their breath.",
      "cards": [
        "Chemtech Enforcer"
      ],
      "board": {
        "you": {
          "runes": 2,
          "points": 0,
          "base": [
            "Chemtech Enforcer"
          ],
          "bf1": [],
          "bf2": []
        },
        "opp": {
          "runes": 0,
          "points": 0,
          "base": [],
          "bf1": [],
          "bf2": []
        }
      }
    },
    {
      "id": "s5",
      "turn": 1,
      "phase": "Ending",
      "title": "Lights Out, For Now",
      "text": "The Ending Phase tidies up: any leftover Energy and Power evaporate, and all damage on units heals away, though nobody is hurt yet. Then Annie's legend passive kicks in and readies up to two of your runes. That sounds tiny, but ready runes on your opponent's turn mean you can pay for Reaction spells while they act. Tuck that away, it will matter soon.",
      "cards": [],
      "board": {
        "you": {
          "runes": 2,
          "points": 0,
          "base": [
            "Chemtech Enforcer"
          ],
          "bf1": [],
          "bf2": []
        },
        "opp": {
          "runes": 0,
          "points": 0,
          "base": [],
          "bf1": [],
          "bf2": []
        }
      }
    },
    {
      "id": "s6",
      "turn": 1,
      "phase": "Opponent",
      "title": "Garen Musters",
      "text": "Garen takes his first turn, and because he went second he channels three runes instead of two, a fair catch-up gift. He spends two of them on Daring Poro, a fluffy 2 might attacker that lands at his base exhausted, exactly like your Enforcer did. Both armies are still stretching. The real fight starts next turn.",
      "cards": [
        "Daring Poro"
      ],
      "board": {
        "you": {
          "runes": 2,
          "points": 0,
          "base": [
            "Chemtech Enforcer"
          ],
          "bf1": [],
          "bf2": []
        },
        "opp": {
          "runes": 3,
          "points": 0,
          "base": [
            "Daring Poro"
          ],
          "bf1": [],
          "bf2": []
        }
      }
    },
    {
      "id": "s7",
      "turn": 2,
      "phase": "Channel",
      "title": "The Engine Warms Up",
      "text": "Awaken flips everything upright, including your Enforcer and all your runes. You channel two more runes for a total of four, then draw a card. Feel the rhythm settling in: every turn you get a little richer and a little deeper. Four runes means real plays are on the menu.",
      "cards": [],
      "board": {
        "you": {
          "runes": 4,
          "points": 0,
          "base": [
            "Chemtech Enforcer"
          ],
          "bf1": [],
          "bf2": []
        },
        "opp": {
          "runes": 3,
          "points": 0,
          "base": [
            "Daring Poro"
          ],
          "bf1": [],
          "bf2": []
        }
      }
    },
    {
      "id": "s8",
      "turn": 2,
      "phase": "Main",
      "title": "March on the Grove",
      "text": "Time to make a move, literally. Exhaust Chemtech Enforcer and walk it from your base to the Grove of the God-Willow. Nobody is home, so after a quick showdown window you take control of the battlefield unopposed. That is a Conquer, and it scores you 1 point on the spot.",
      "cards": [
        "Chemtech Enforcer"
      ],
      "choice": {
        "prompt": "Your Enforcer has Assault 2. If Garen attacks the Grove later and your Enforcer defends, how hard does it hit back?",
        "options": [
          {
            "label": "2 might, Assault only counts while attacking",
            "correct": true,
            "response": "You got it. Assault is a lunge, not a stance. Attackers get the bonus, defenders fight with their printed might."
          },
          {
            "label": "4 might, Assault always applies",
            "correct": false,
            "response": "Close, but Assault only adds might while the unit is attacking. On defense your Enforcer swings at its printed 2. Remember this, it decides fights."
          }
        ]
      },
      "board": {
        "you": {
          "runes": 4,
          "points": 1,
          "base": [],
          "bf1": [],
          "bf2": [
            "Chemtech Enforcer"
          ]
        },
        "opp": {
          "runes": 3,
          "points": 0,
          "base": [
            "Daring Poro"
          ],
          "bf1": [],
          "bf2": []
        }
      }
    },
    {
      "id": "s9",
      "turn": 2,
      "phase": "Main",
      "title": "Reinforcements",
      "text": "Spend three of your four runes on Flame Chompers, a snappy 3 might unit that waits at your base, exhausted as always. Your board is taking shape: one unit banking a point out at the Grove and one at home, ready to move out next turn. When the turn ends your pools empty again and Annie readies two runes on the way out.",
      "cards": [
        "Flame Chompers"
      ],
      "board": {
        "you": {
          "runes": 4,
          "points": 1,
          "base": [
            "Flame Chompers"
          ],
          "bf1": [],
          "bf2": [
            "Chemtech Enforcer"
          ]
        },
        "opp": {
          "runes": 3,
          "points": 0,
          "base": [
            "Daring Poro"
          ],
          "bf1": [],
          "bf2": []
        }
      }
    },
    {
      "id": "s10",
      "turn": 2,
      "phase": "Opponent",
      "title": "Garen Answers",
      "text": "Garen channels two more runes, reaching five, and mirrors your plan. Daring Poro marches into the empty Back-Alley Bar and Conquers it, scoring him 1 point, and Cithria of Cloudfield joins his base. Then he does something sneaky: he passes the turn with three runes still standing upright. When an opponent banks ready runes like that, smell a trick coming.",
      "cards": [
        "Daring Poro",
        "Cithria of Cloudfield"
      ],
      "board": {
        "you": {
          "runes": 4,
          "points": 1,
          "base": [
            "Flame Chompers"
          ],
          "bf1": [],
          "bf2": [
            "Chemtech Enforcer"
          ]
        },
        "opp": {
          "runes": 5,
          "points": 1,
          "base": [
            "Cithria of Cloudfield"
          ],
          "bf1": [
            "Daring Poro"
          ],
          "bf2": []
        }
      }
    },
    {
      "id": "s11",
      "turn": 3,
      "phase": "Beginning",
      "title": "The Hold",
      "text": "Your turn three opens with the Beginning Phase, and this is where patience pays out. You still control the Grove from last turn, so you score a Hold for 1 more point, and the Grove's own ability fires: when you hold here, draw 1. You now lead 2 points to 1, and you have not thrown a punch yet.",
      "cards": [],
      "choice": {
        "prompt": "Why did the Grove score for you again this turn?",
        "options": [
          {
            "label": "Holding a battlefield during your own Beginning Phase scores 1 point",
            "correct": true,
            "response": "That is the engine of the whole game. Conquer a battlefield once, then Hold it every turn for steady points while your opponent scrambles."
          },
          {
            "label": "You conquered it again automatically",
            "correct": false,
            "response": "Not quite. Conquer only scores when you take control, and the Grove was already yours. This fresh point came from the Hold."
          },
          {
            "label": "Battlefields score in every phase",
            "correct": false,
            "response": "Generous, but no. Each battlefield can give you one Conquer and one Hold per turn at most, and Holds are only checked during your own Beginning Phase."
          }
        ]
      },
      "board": {
        "you": {
          "runes": 4,
          "points": 2,
          "base": [
            "Flame Chompers"
          ],
          "bf1": [],
          "bf2": [
            "Chemtech Enforcer"
          ]
        },
        "opp": {
          "runes": 5,
          "points": 1,
          "base": [
            "Cithria of Cloudfield"
          ],
          "bf1": [
            "Daring Poro"
          ],
          "bf2": []
        }
      }
    },
    {
      "id": "s12",
      "turn": 3,
      "phase": "Main",
      "title": "Jinx Reports for Duty",
      "text": "Channel two runes for a total of six, draw, and meet your closer. Jinx - Demolitionist costs 3 Energy plus 1 Fury Power, and her Accelerate option is an extra 1 Energy plus 1 Fury Power on top. Pay the whole bill: exhaust four runes and recycle both Fury Runes to the bottom of your rune deck, leaving four runes on the board, then discard 2 cards for her arrival ability, the classic Fury tax. The payoff is that Jinx enters play ready instead of exhausted, and she is itching to move right now.",
      "cards": [
        "Jinx - Demolitionist"
      ],
      "board": {
        "you": {
          "runes": 4,
          "points": 2,
          "base": [
            "Flame Chompers",
            "Jinx - Demolitionist"
          ],
          "bf1": [],
          "bf2": [
            "Chemtech Enforcer"
          ]
        },
        "opp": {
          "runes": 5,
          "points": 1,
          "base": [
            "Cithria of Cloudfield"
          ],
          "bf1": [
            "Daring Poro"
          ],
          "bf2": []
        }
      }
    },
    {
      "id": "s13",
      "turn": 3,
      "phase": "Combat",
      "title": "Storm the Bar",
      "text": "March Flame Chompers and Jinx from your base into the Back-Alley Bar, where Daring Poro stands guard. Enemies present means combat, and combat opens with a showdown where both players may fire off Action and Reaction spells, with you as the attacker acting first. You hold steady, and Garen springs the trap those ready runes were hiding: Cannon Barrage, a Reaction that deals 2 damage to each of your units in the fight. Chompers is dented at 2 of 3, Jinx shrugs at 2 of 4, and now the real damage step begins.",
      "cards": [
        "Cannon Barrage"
      ],
      "board": {
        "you": {
          "runes": 4,
          "points": 2,
          "base": [],
          "bf1": [
            "Flame Chompers",
            "Jinx - Demolitionist"
          ],
          "bf2": [
            "Chemtech Enforcer"
          ]
        },
        "opp": {
          "runes": 4,
          "points": 1,
          "base": [
            "Cithria of Cloudfield"
          ],
          "bf1": [
            "Daring Poro"
          ],
          "bf2": []
        }
      }
    },
    {
      "id": "s14",
      "turn": 3,
      "phase": "Combat",
      "title": "Do the Math",
      "text": "Damage time. Each side totals the might of its units and deals that much to the other side, all at once, and if both sides are still standing afterward the attackers get recalled home, because the defender wins ties. When you assign damage you must fully pay one unit's lethal before spilling into the next. Total up your attackers before you answer.",
      "cards": [
        "Flame Chompers",
        "Jinx - Demolitionist",
        "Daring Poro"
      ],
      "choice": {
        "prompt": "What is your total attacking might at the Bar?",
        "options": [
          {
            "label": "9: Chompers 3, plus Jinx 4 with Assault 2",
            "correct": true,
            "response": "Perfect math. Poro only needs 2 of that, so it drops with plenty to spare. At the same moment Poro deals its 2 into Chompers, who already carried 2 from the Barrage, and 4 damage against 3 might is lethal. You trade the Chompers, Jinx survives at 2 damage, and with no defenders left you Conquer the Bar."
          },
          {
            "label": "7: Chompers 3 plus Jinx 4",
            "correct": false,
            "response": "So close. Jinx is attacking, so her Assault 2 is live and the true total is 9. Either way the Poro falls, but always count your Assault when you plan a fight."
          },
          {
            "label": "5: only Jinx counts",
            "correct": false,
            "response": "Do not bench the Chompers, every attacker adds its might. Chompers 3, plus Jinx 4, plus her Assault 2 makes 9 in total."
          }
        ]
      },
      "board": {
        "you": {
          "runes": 4,
          "points": 3,
          "base": [],
          "bf1": [
            "Jinx - Demolitionist"
          ],
          "bf2": [
            "Chemtech Enforcer"
          ]
        },
        "opp": {
          "runes": 4,
          "points": 1,
          "base": [
            "Cithria of Cloudfield"
          ],
          "bf1": [],
          "bf2": []
        }
      }
    },
    {
      "id": "s15",
      "turn": 3,
      "phase": "Ending",
      "title": "Cool Down",
      "text": "That trade handed you the Bar, a Conquer worth 1 more point, so you lead 3 to 1 with a unit parked on each battlefield. Notice Jinx is already back at a full 4 might: survivors heal the moment a combat ends, and the Ending Phase then wipes any other damage too, so wounds never carry between turns. Annie readies two runes on the way out, which means Gust, your 1 Energy Reaction, is live on Garen turn if he charges the Grove. Sleep with one eye open, Garen.",
      "cards": [
        "Gust"
      ],
      "board": {
        "you": {
          "runes": 4,
          "points": 3,
          "base": [],
          "bf1": [
            "Jinx - Demolitionist"
          ],
          "bf2": [
            "Chemtech Enforcer"
          ]
        },
        "opp": {
          "runes": 4,
          "points": 1,
          "base": [
            "Cithria of Cloudfield"
          ],
          "bf1": [],
          "bf2": []
        }
      }
    },
    {
      "id": "s16",
      "turn": 4,
      "phase": "Beginning",
      "title": "The Road to Eight",
      "text": "Let us fast forward. If you keep both battlefields through Garen's turn, your next Beginning Phase pays out two Holds at once and the points snowball toward the finish line at 8. One last rule before we let go of the handlebars: a Hold can always deliver the winning point, but a Conquer only wins the game if you scored every battlefield that turn, and otherwise you draw a card instead of taking the crown. That is why planting your flag and defending it is the strongest plan in Riftbound.",
      "cards": [],
      "choice": {
        "prompt": "You are sitting at 7 points. Which play actually wins the game?",
        "options": [
          {
            "label": "Scoring a Hold at your Beginning Phase",
            "correct": true,
            "response": "That is the clean kill. A Hold can always take the winning point, no strings attached. Control the map, keep it, and the game hands you the trophy."
          },
          {
            "label": "Conquering the Bar while Garen keeps the Grove",
            "correct": false,
            "response": "Sneaky, but no. A Conquer only delivers the winning point if you scored every battlefield that turn. Here you would draw a card instead, which is still value, just not the victory."
          },
          {
            "label": "Any point at all, 8 is 8",
            "correct": false,
            "response": "Almost! The winning point is picky. Holds always count for the win, but a lone Conquer that leaves a battlefield unscored converts into a card draw at match point."
          }
        ]
      },
      "board": {
        "you": {
          "runes": 4,
          "points": 3,
          "base": [],
          "bf1": [
            "Jinx - Demolitionist"
          ],
          "bf2": [
            "Chemtech Enforcer"
          ]
        },
        "opp": {
          "runes": 4,
          "points": 1,
          "base": [
            "Cithria of Cloudfield"
          ],
          "bf1": [],
          "bf2": []
        }
      }
    }
  ],
  "outro": "And that is the heartbeat of Riftbound: channel runes, spend them as Energy or Power, put bodies on battlefields, and squeeze points out of Conquers and Holds until somebody hits 8. Annie wants tempo, tricks, and fire, Garen wants big bodies and patient defense, and you just played three turns of both philosophies colliding. Shuffle up your own starter deck and go make some noise on the Rift."
}
