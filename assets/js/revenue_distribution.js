
// Scores indexed by weathersit+windspeed*2+hum*4+atemp*8+temp*16
const SCORES = [0.497684415531085,
    0.5861968470268459,
    0.5189931084695751,
    0.6002358835072354,
    0.5115016270978097,
    0.5894179167577306,
    0.542043500640761,
    0.6007334980030781,
    0.7341670555056041,
    0.7896672334423613,
    0.7421057213356153,
    0.7944802952616962,
    0.7606675439146164,
    0.7913320600718898,
    0.7762167674146538,
    0.7984636716771274,
    0.7307138020720825,
    0.7875456751429042,
    0.7411082193259495,
    0.7940984949526985,
    0.7553879164112012,
    0.7886535730715591,
    0.7741968768836788,
    0.7976084617625782,
    0.7342238166200031,
    0.7898698655699006,
    0.7426973448467635,
    0.795210599055723,
    0.7606861469721825,
    0.7914395261171246,
    0.7765242354005804,
    0.7990404690894216];

const feature_similarities = { "temp": { "temp": 1.0000000000000002, "hum": 0.13289766592788843, "windspeed": 0.1605633920543806, "atemp": 0.9916503489582373, "weathersit": 0.1156456561850893 }, "hum": { "temp": 0.13289766592788843, "hum": 1.0, "windspeed": 0.2528503081201282, "atemp": 0.14499642469142687, "weathersit": 0.5935205212962443 }, "windspeed": { "temp": 0.1605633920543806, "hum": 0.2528503081201282, "windspeed": 1.0, "atemp": 0.18598202361531693, "weathersit": 0.04424973438584393 }, "atemp": { "temp": 0.9916503489582373, "hum": 0.14499642469142687, "windspeed": 0.18598202361531693, "atemp": 0.9999999999999999, "weathersit": 0.11758432089630765 }, "weathersit": { "temp": 0.1156456561850893, "hum": 0.5935205212962443, "windspeed": 0.04424973438584393, "atemp": 0.11758432089630765, "weathersit": 0.9999999999999999 } };

const FEATURE_NAMES = {
    'weathersit': 'Weather Situation',
    'windspeed': 'Wind Speed',
    'hum': 'Humidity',
    'atemp': 'Felt Temperature',
    'temp': 'Temperature'
}

const FEATURE_INDICES = {
    'weathersit': 0,
    'windspeed': 1,
    'hum': 2,
    'atemp': 3,
    'temp': 4
}

const FEATURE_REFERENCES = ["feat-A-1", "feat-A-2", "feat-A-3", "feat-B-1", "feat-B-2", "feat-B-3"]

var feature_holders = [undefined, undefined, undefined, undefined, undefined]
var robustness_regularization_parameter = 1.0;
var is_robust = false;

function get_score(weathersit, windspeed, hum, atemp, temp) {
    return SCORES[weathersit + windspeed * 2 + hum * 4 + atemp * 8 + temp * 16]
}

function update_robustness() {
    const robustness_checkbox = document.getElementById("robustness-checkbox")
    is_robust = robustness_checkbox.checked;
    update_display();
}

function get_score_active_features(arr) {
    var activations = [0, 0, 0, 0, 0]
    for (const feature of arr) {
        activations[FEATURE_INDICES[feature]] = 1;
    }
    return get_score(activations[0], activations[1], activations[2], activations[3], activations[4])
}

function all_permutations(inputArr) {
    var results = [];

    function permute(arr, memo) {
        var cur, memo = memo || [];

        for (var i = 0; i < arr.length; i++) {
            cur = arr.splice(i, 1);
            if (arr.length === 0) {
                results.push(memo.concat(cur));
            }
            permute(arr.slice(), memo.concat(cur));
            arr.splice(i, 0, cur[0]);
        }

        return results;
    }

    return permute(inputArr);
}

function get_shapley_values(features) {
    const permutations = all_permutations([...Array(features.length).keys()]);
    var shapley_values = [];

    for (var i = 0; i < features.length; i++) {
        shapley_values.push(0);
    }

    for (const permutation of permutations) {
        var features_on = [];
        var score = get_score_active_features(features_on);
        for (const feature_index of permutation) {
            features_on.push(features[feature_index]);
            const score_with_feature = get_score_active_features(features_on);
            shapley_values[feature_index] += score_with_feature - score;
            score = score_with_feature;
        }
    }

    for (var i = 0; i < features.length; i++) {
        shapley_values[i] /= permutations.length;
    }

    return shapley_values;
}

function get_feature_similarity(feature_1, feature_2) {
    return feature_similarities[feature_1][feature_2];
}

function get_total_feature_similarities(features) {
    var total_feature_similarities = [];

    for (var i = 0; i < features.length; i++) {
        var total_feature_similarity = 0;
        for (var j = 0; j < features.length; j++) {
            if (i !== j) {
                total_feature_similarity += get_feature_similarity(features[i], features[j]);
            }
        }
        total_feature_similarities.push(total_feature_similarity);
    }
    return total_feature_similarities;
}

function get_robust_shapley_values(features) {
    const shapley_values = get_shapley_values(features);

    const total_feature_similarities = get_total_feature_similarities(features);

    var robust_shapley_values = [];

    for (var i = 0; i < features.length; i++) {
        robust_shapley_values.push(shapley_values[i] * Math.exp(-robustness_regularization_parameter * total_feature_similarities[i]));
    }

    return robust_shapley_values;
}

function add_feature_dialog(feature_name) {
    const dialog = document.getElementById("dialog-" + feature_name)

    dialog.showModal();
}

function add_feature(feature_name, feature_selected) {

    const info_div = document.getElementById("info-" + feature_name)

    info_div.innerHTML = FEATURE_NAMES[feature_selected] + '<br>\n'
    info_div.innerHTML += "<span id='shapley-" + feature_name + "'>Shapley=</span><br>\n"
    info_div.innerHTML += '<p><button onclick="remove_feature(\'' + feature_name + '\')">-Remove Feature</button><p></div>'
    feature_holders[FEATURE_REFERENCES.indexOf(feature_name)] = feature_selected;
    update_display();
}


function add_feature_dialog_closed(feature_name) {
    const dialog = document.getElementById("dialog-" + feature_name)
    const select = document.getElementById("select-" + feature_name)
    const selected = select.options[select.selectedIndex].value;

    dialog.close();
    add_feature(feature_name, selected)
}

function remove_feature(feature_name) {
    const info_div = document.getElementById("info-" + feature_name)

    info_div.innerHTML = '<button onclick="add_feature_dialog(\'' + feature_name + '\')">+Add Feature</button>'
    feature_holders[FEATURE_REFERENCES.indexOf(feature_name)] = undefined
    update_display();
}

function onlyUnique(value, index, array) {
    return array.indexOf(value) === index;
}

function update_display() {
    var features = [];
    var active_references = [];

    const robustness_slider = document.getElementById("robustness-slider");
    robustness_regularization_parameter = robustness_slider.value;
    console.log(robustness_regularization_parameter)

    console.log(feature_holders)

    for (var i = 0; i < feature_holders.length; i++) {
        const held_feature = feature_holders[i];
        if (held_feature !== undefined) {
            features.push(held_feature)
            active_references.push(FEATURE_REFERENCES[i])
        }
    }


    console.log(feature_holders)
    var shapley_values = [];
    var total_feature_similarities = [];
    var robust_shapley_values = []
    const total_gain = get_score_active_features(features) - get_score_active_features([]);
    if (is_robust) {
        total_feature_similarities = get_total_feature_similarities(features);
        shapley_values = get_shapley_values(features);
        robust_shapley_values = get_robust_shapley_values(features);
    }
    else {
        shapley_values = get_shapley_values(features);
        robust_shapley_values = shapley_values;
    }

    payouts = [0, 0];

    for (const [feature_reference, shapley_value, robust_shapley_value, total_feature_similarity] of active_references.map((e, i) => [e, shapley_values[i], robust_shapley_values[i], total_feature_similarities[i]])) {
        const shapley_span = document.getElementById("shapley-" + feature_reference)
        console.log("Feature ref: " + feature_reference)
        if (shapley_span !== undefined) {
            shapley_span.innerHTML = "Shapley=€" + (shapley_value * 1000).toFixed(2) + "\n"
            if ("feat-A" === feature_reference.substring(0, 6)) {
                payouts[0] += robust_shapley_value
            }
            else {
                payouts[1] += robust_shapley_value
            }

            if (is_robust) {
                shapley_span.innerHTML += "<br/> R exponent=" + (-robustness_regularization_parameter * total_feature_similarity).toFixed(2) + "";
                shapley_span.innerHTML += "<br/> Robust Shapley=€" + (robust_shapley_value * 1000).toFixed(2) + ""
            }
        }
    }

    const A_payout = document.getElementById("A-payout")
    const B_payout = document.getElementById("B-payout")
    const prediction_gain = document.getElementById("prediction-gain")
    const total_payout = document.getElementById("total-payout")

    A_payout.innerHTML = "€" + (payouts[0] * 1000).toFixed(2)
    B_payout.innerHTML = "€" + (payouts[1] * 1000).toFixed(2)
    prediction_gain.innerHTML = "€" + (total_gain * 1000).toFixed(2)
    total_payout.innerHTML = "€" + ((payouts[0] + payouts[1]) * 1000).toFixed(2)


}
