import React = require('react');
import $ = require('jquery');

let keywordData: any = undefined;
let issuesData: any = undefined;

$.getJSON('./keywords.json', data => {
	keywordData = data;
});
$.getJSON('./issues.json', data => {
	issuesData = data;
});

interface ResultRowProps extends React.Props<ResultRow> {
	issue: MinimalIssue;
}
class ResultRow extends React.Component<ResultRowProps, {}> {
	render() {
		return <div className="result">
			<div className="id">{this.props.issue.number}</div>
			<div className="title">{this.props.issue.title}</div>
			<div className="by">{this.props.issue.loggedByName} at {this.props.issue.createdAt}</div>
			<div className="labels">{this.props.issue.labels.map(lbl => lbl.name).join(', ')</div>
			<div className="comments">{this.props.issue.comments}</div>
		</div>;
	}
}

$(() => {
	$('#query').on('change', refreshQuery);
	let priorTimeout: number = undefined;
	$('#query').on('keyup', () => {
		if(priorTimeout !== undefined) {
			window.clearTimeout(priorTimeout);
		}
		priorTimeout = window.setTimeout(refreshQuery, 200);
	});

	window.setTimeout(refreshQuery, 200);
});

let lastQuery: string = undefined;
function refreshQuery() {
	if(keywordData === undefined || issuesData === undefined) {
		console.log('Waiting...');
		window.setTimeout(refreshQuery, 250);
		return;
	}

	let noHits: string[] = [];

	let text = $('#query').val();
	if(text === lastQuery) {
		return;
	}
	lastQuery = text;

	let ids: number[] = undefined;
	let terms = text.split(' ');
	let result: MinimalIssue[] = undefined;
	terms.forEach(term => {
		if(term.indexOf(':') < 0) {
			term = 'term:' + term;
		}
		let match = keywordData[term];

		if(match) {
			if(ids === undefined) {
				ids = match;
			} else {
				ids = ids.filter(i => match.indexOf(i) >= 0);
			}
		} else {
			noHits.push(term);

		}
	});

	ids = ids || [];
	let issues = ids.map(id => {
		let issue = issuesData.filter(iss => iss.number === id)[0];
		return issue;
	});

	let warningsDiv = $('#warnings').get(0);
	if (noHits.length > 0) {
		React.render(<div className="warnings">No hits for {noHits.join(', ')}</div>, warningsDiv);
	} else {
		React.render(<div className="warnings"></div>, warningsDiv); 
	}

	let resultsTarget = $('#results').get(0);
	React.render(<div id="results">{issues.map((issue, index) => <ResultRow issue={issue} key={index} />) }</div>, resultsTarget);
}

