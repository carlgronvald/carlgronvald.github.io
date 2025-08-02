import numpy as np

ocds_paper = np.array([0.886, 0.906, 0.827, 0.951, 0.939, 0.886, 0.912, 0.926])
ocds_mine = np.array([0.753, 0.7480, 0.701, 0.921, 0.934, 0.732, 0.733, 0.766])
olm = np.array([0.767, 0.795, 0.705, 0.938, 0.938, 0.732, 0.750, 0.783])
log = np.array([0.858, 0.937, 0.755, 0.993, 0.961, 0.791, 0.960, 0.864])
accuracies = np.array([ocds_paper, ocds_mine, olm, log]).T
datasets = [
    "australian",
    "ionosphere",
    "german",
    "wdbc",
    "wbc",
    "magic04",
    "kr-vs-kp",
    "credit-a",
]

methods = ["OCDS (paper)", "OCDS (mine)", "OLM", "Logistic UB"]

table = "<table>\n"
table += "  <tr>\n"
table += "    <th></th>"

for method in methods:
    table += f"<th>{method}</th>"

table += "\n  </tr>\n"


for i in range(len(datasets)):
    table += "  <tr>\n"
    table += f"    <td>{datasets[i]}</td>"
    for k in range(4):
        table += f"<td>{accuracies[i,k]:.3f}</td>"
    table += "\n  </tr>\n"

table += "</table>"
print(table)
