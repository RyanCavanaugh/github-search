var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", 'react', 'jquery'], function (require, exports, React, $) {
    var keywordData = undefined;
    var issuesData = undefined;
    $.getJSON('./keywords.json', function (data) {
        keywordData = data;
    });
    $.getJSON('./issues.json', function (data) {
        issuesData = data;
    });
    var ResultRow = (function (_super) {
        __extends(ResultRow, _super);
        function ResultRow() {
            _super.apply(this, arguments);
        }
        ResultRow.prototype.render = function () {
            return React.createElement("div", {"className": "result"}, React.createElement("div", {"className": "id"}, this.props.issue.number), React.createElement("div", {"className": "title"}, this.props.issue.title), React.createElement("div", {"className": "by"}, this.props.issue.loggedByName, "at ", this.props.issue.createdAt), React.createElement("div", {"className": "labels"}, this.props.issue.labels.map(function (lbl) { return lbl.name; }).join(', ')), React.createElement("div", {"className": "comments"}, this.props.issue.comments));
        };
        return ResultRow;
    })(React.Component);
    $(function () {
        $('#query').on('change', refreshQuery);
        var priorTimeout = undefined;
        $('#query').on('keyup', function () {
            if (priorTimeout !== undefined) {
                window.clearTimeout(priorTimeout);
            }
            priorTimeout = window.setTimeout(refreshQuery, 200);
        });
        window.setTimeout(refreshQuery, 200);
    });
    var lastQuery = undefined;
    function refreshQuery() {
        if (keywordData === undefined || issuesData === undefined) {
            console.log('Waiting...');
            window.setTimeout(refreshQuery, 250);
            return;
        }
        var noHits = [];
        var text = $('#query').val();
        if (text === lastQuery) {
            return;
        }
        lastQuery = text;
        var ids = undefined;
        var terms = text.split(' ');
        var result = undefined;
        terms.forEach(function (term) {
            if (term.indexOf(':') < 0) {
                term = 'term:' + term;
            }
            var match = keywordData[term];
            if (match) {
                if (ids === undefined) {
                    ids = match;
                }
                else {
                    ids = ids.filter(function (i) { return match.indexOf(i) >= 0; });
                }
            }
            else {
                noHits.push(term);
            }
        });
        ids = ids || [];
        var issues = ids.map(function (id) {
            var issue = issuesData.filter(function (iss) { return iss.number === id; })[0];
            return issue;
        });
        var warningsDiv = $('#warnings').get(0);
        if (noHits.length > 0) {
            React.render(React.createElement("div", {"className": "warnings"}, "No hits for ", noHits.join(', ')), warningsDiv);
        }
        else {
            React.render(React.createElement("div", {"className": "warnings"}), warningsDiv);
        }
        var resultsTarget = $('#results').get(0);
        React.render(React.createElement("div", {"id": "results"}, issues.map(function (issue, index) { return React.createElement(ResultRow, {"issue": issue, "key": index}); })), resultsTarget);
    }
});
