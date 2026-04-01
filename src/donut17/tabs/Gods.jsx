import React, { useState } from "react";
import { C, F } from "../d17.js";

var h = React.createElement;

function GodPortrait(props) {
  var god = props.god;
  var active = props.active;
  var onClick = props.onClick;
  var errState = useState(false);
  var err = errState[0];
  var setErr = errState[1];
  var hoverState = useState(false);
  var hovered = hoverState[0];
  var setHovered = hoverState[1];

  var borderColor = active ? god.color : (hovered ? god.color + "88" : god.color + "44");
  var shadow = active ? ("0 0 16px " + god.color + "44") : "none";

  return h("div", {
    onClick: onClick,
    onMouseEnter: function() { setHovered(true); },
    onMouseLeave: function() { setHovered(false); },
    style: {
      cursor: "pointer",
      width: 120,
      borderRadius: 10,
      border: "2px solid " + borderColor,
      boxShadow: shadow,
      background: active ? god.color + "15" : C.surfaceLow,
      overflow: "hidden",
      transition: "all 0.18s ease",
    }
  },
    h("div", {
      style: {
        width: "100%",
        height: 90,
        overflow: "hidden",
        position: "relative",
      }
    },
      !err && god.image
        ? h("img", {
            src: god.image,
            alt: god.name,
            style: {
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top",
              display: "block",
            },
            onError: function() { setErr(true); },
          })
        : h("div", {
            style: {
              height: "100%",
              background: god.color + "22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontFamily: F.headline,
              fontWeight: 700,
              color: god.color,
            }
          }, god.name.slice(0, 1)),
      h("div", {
        style: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 44,
          background: "linear-gradient(to top, " + C.surfaceLow + " 0%, transparent 100%)",
          pointerEvents: "none",
        }
      })
    ),
    h("div", { style: { padding: "6px 8px" } },
      h("div", {
        style: {
          fontFamily: F.headline,
          fontSize: 11,
          fontWeight: 700,
          color: active ? god.color : C.text,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.2,
        }
      }, god.name),
      h("div", {
        style: {
          fontSize: 10,
          color: C.textDim,
          fontFamily: F.label,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.3,
        }
      }, god.title)
    )
  );
}

function GodDetailCard(props) {
  var god = props.god;
  var errState = useState(false);
  var err = errState[0];
  var setErr = errState[1];

  var stages = ["stage2", "stage3", "stage4"];
  var stageLabels = ["Stage 2 Offerings", "Stage 3 Offerings", "Stage 4 Offerings"];

  return h("div", {
    style: {
      background: C.surface,
      borderRadius: 12,
      border: "1px solid " + god.color + "44",
      overflow: "hidden",
      display: "flex",
    }
  },
    // Portrait section
    h("div", {
      style: {
        width: 200,
        minHeight: 200,
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
      }
    },
      !err && god.image
        ? h("img", {
            src: god.image,
            alt: god.name,
            style: {
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top",
              display: "block",
              minHeight: 200,
            },
            onError: function() { setErr(true); },
          })
        : h("div", {
            style: {
              height: 200,
              background: god.color + "22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontFamily: F.headline,
              fontWeight: 700,
              color: god.color,
            }
          }, god.name.slice(0, 1)),
      // Gradient fade-right overlay
      h("div", {
        style: {
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to right, transparent 50%, " + C.surface + " 100%)",
          pointerEvents: "none",
        }
      })
    ),

    // Content section
    h("div", {
      style: { flex: 1, padding: "20px 24px", minWidth: 0 }
    },
      // Name + title
      h("div", { style: { marginBottom: 16 } },
        h("div", {
          style: {
            fontFamily: F.headline,
            fontSize: 26,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: -0.5,
            color: god.color,
            lineHeight: 1,
          }
        }, god.name),
        h("div", {
          style: {
            fontFamily: F.label,
            fontSize: 11,
            color: C.textDim,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginTop: 4,
          }
        }, god.title)
      ),

      // Blessing section (dark card)
      god.blessing
        ? h("div", {
            style: {
              background: god.color + "0d",
              border: "1px solid " + god.color + "44",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
            }
          },
            h("div", {
              style: {
                fontSize: 10,
                fontFamily: F.label,
                color: god.color,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 4,
                fontWeight: 700,
              }
            }, "4-7 Blessing"),
            h("div", {
              style: {
                fontSize: 12,
                fontFamily: F.body,
                color: C.textMuted,
                lineHeight: 1.5,
              }
            }, god.blessing)
          )
        : null,

      // Stage offerings: 3-column grid
      h("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
          borderTop: "1px solid " + C.border + "44",
          paddingTop: 16,
        }
      },
        stages.map(function(stage, i) {
          var offerings = god.offerings && god.offerings[stage] ? god.offerings[stage] : [];
          return h("div", { key: stage },
            h("div", {
              style: {
                fontSize: 11,
                fontFamily: F.label,
                color: C.secondary,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 8,
                fontWeight: 600,
              }
            }, stageLabels[i]),
            h("ul", { style: { listStyle: "none", margin: 0, padding: 0 } },
              offerings.map(function(offer, oi) {
                return h("li", {
                  key: oi,
                  style: {
                    display: "flex",
                    gap: 6,
                    marginBottom: 5,
                    alignItems: "flex-start",
                  }
                },
                  h("span", {
                    style: {
                      color: god.color,
                      fontSize: 8,
                      marginTop: 3,
                      flexShrink: 0,
                    }
                  }, "\u25A0"),
                  h("span", {
                    style: {
                      fontSize: 11,
                      fontFamily: F.body,
                      color: C.textMuted,
                      lineHeight: 1.4,
                    }
                  }, offer)
                );
              })
            )
          );
        })
      ),

      // Related comps as pills
      god.bestComps && god.bestComps.length > 0
        ? h("div", {
            style: {
              marginTop: 14,
              borderTop: "1px solid " + C.border + "44",
              paddingTop: 12,
            }
          },
            h("div", {
              style: {
                fontSize: 10,
                fontFamily: F.label,
                color: C.textDim,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 6,
                fontWeight: 600,
              }
            }, "Best Comps"),
            h("div", {
              style: { display: "flex", gap: 5, flexWrap: "wrap" }
            },
              god.bestComps.map(function(comp, ci) {
                return h("span", {
                  key: ci,
                  style: {
                    fontSize: 10,
                    background: god.color + "18",
                    color: god.color,
                    padding: "3px 9px",
                    borderRadius: 12,
                    fontFamily: F.label,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }
                }, comp);
              })
            )
          )
        : null,

      // Tip section
      god.tip
        ? h("div", {
            style: {
              marginTop: 14,
              borderTop: "1px solid " + C.border + "44",
              paddingTop: 12,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }
          },
            h("span", {
              style: {
                fontSize: 11,
                fontFamily: F.label,
                color: god.color,
                letterSpacing: 1,
                textTransform: "uppercase",
                flexShrink: 0,
                paddingTop: 1,
                fontWeight: 700,
              }
            }, "Tip"),
            h("span", {
              style: {
                fontSize: 11,
                fontFamily: F.body,
                color: C.textDim,
                fontStyle: "italic",
                lineHeight: 1.5,
              }
            }, god.tip)
          )
        : null
    )
  );
}

function Gods(props) {
  var gods = props.gods;
  var selState = useState(null);
  var selected = selState[0];
  var setSelected = selState[1];

  return h("div", null,
    // Hero section (inline, new pattern)
    h("div", {
      style: {
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(160deg, rgba(240,204,0,0.18) 0%, rgba(240,204,0,0.05) 60%, transparent 100%)",
        borderRadius: 16,
        padding: "40px 32px",
        marginBottom: 28,
      }
    },
      h("div", {
        style: {
          position: "absolute",
          right: -60,
          top: -60,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(240,204,0,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }
      }),
      h("h2", {
        style: {
          fontFamily: F.headline,
          fontWeight: 700,
          fontSize: 28,
          textTransform: "uppercase",
          color: C.text,
          margin: "0 0 8px",
          lineHeight: 1,
        }
      }, "Space Gods"),
      h("p", {
        style: {
          fontFamily: F.body,
          fontSize: 14,
          color: C.textMuted,
          margin: 0,
          maxWidth: 520,
          lineHeight: 1.6,
        }
      }, "Choose one God each run. Blessings unlock at stages 2, 3, and 4.")
    ),

    // God portrait grid
    h("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 24,
      }
    },
      gods.map(function(god, idx) {
        var active = selected === idx;
        return h(GodPortrait, {
          key: god.key,
          god: god,
          active: active,
          onClick: function() { setSelected(active ? null : idx); },
        });
      })
    ),

    // God detail cards
    h("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }
    },
      (selected !== null ? [gods[selected]] : gods).map(function(god) {
        return h(GodDetailCard, { key: god.key, god: god });
      })
    )
  );
}

export default Gods;
