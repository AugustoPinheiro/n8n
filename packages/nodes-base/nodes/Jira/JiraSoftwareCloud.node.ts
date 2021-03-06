import {
	IExecuteFunctions,
} from 'n8n-core';
import {
	IDataObject,
	INodeTypeDescription,
	INodeExecutionData,
	INodeType,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';
import {
	jiraSoftwareCloudApiRequest,
	jiraSoftwareCloudApiRequestAllItems,
	validateJSON,
} from './GenericFunctions';
import {
	issueOperations,
	issueFields,
} from './IssueDescription';
import {
	IIssue,
	IFields,
	INotify,
	INotificationRecipients,
	NotificationRecipientsRestrictions,
 } from './IssueInterface';

export class JiraSoftwareCloud implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Jira Software',
		name: 'Jira Software Cloud',
		icon: 'file:jira.png',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume Jira Software API',
		defaults: {
			name: 'Jira Software',
			color: '#c02428',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'jiraSoftwareCloudApi',
				required: true,
				displayOptions: {
					show: {
						jiraVersion: [
							'cloud',
						],
					},
				},
			},
			{
				name: 'jiraSoftwareServerApi',
				required: true,
				displayOptions: {
					show: {
						jiraVersion: [
							'server',
						],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Jira Version',
				name: 'jiraVersion',
				type: 'options',
				options: [
					{
						name: 'Cloud',
						value: 'cloud',
					},
					{
						name: 'Server (Self Hosted)',
						value: 'server',
					},
				],
				default: 'cloud',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Issue',
						value: 'issue',
						description: 'Creates an issue or, where the option to create subtasks is enabled in Jira, a subtask',
					},
				],
				default: 'issue',
				description: 'Resource to consume.',
			},
			...issueOperations,
			...issueFields,
		],
	};

	methods = {
		loadOptions: {
			// Get all the projects to display them to user so that he can
			// select them easily
			async getProjects(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const jiraCloudCredentials = this.getCredentials('jiraSoftwareCloudApi');
				let projects;
				let endpoint = '/project/search';
				if (jiraCloudCredentials === undefined) {
					endpoint = '/project';
				}
				try {
					projects = await jiraSoftwareCloudApiRequest.call(this, endpoint, 'GET');
				} catch (err) {
					throw new Error(`Jira Error: ${err}`);
				}
				if (projects.values && Array.isArray(projects.values)) {
					projects = projects.values;
				}
				for (const project of projects) {
					const projectName = project.name;
					const projectId = project.id;
					returnData.push({
						name: projectName,
						value: projectId,
					});
				}
				return returnData;
			},

			// Get all the issue types to display them to user so that he can
			// select them easily
			async getIssueTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				let issueTypes;
				try {
					issueTypes = await jiraSoftwareCloudApiRequest.call(this, '/issuetype', 'GET');
				} catch (err) {
					throw new Error(`Jira Error: ${err}`);
				}
				for (const issueType of issueTypes) {
					const issueTypeName = issueType.name;
					const issueTypeId = issueType.id;

					returnData.push({
						name: issueTypeName,
						value: issueTypeId,
					});
				}
				return returnData;
			},

			// Get all the labels to display them to user so that he can
			// select them easily
			async getLabels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				let labels;
				try {
					labels = await jiraSoftwareCloudApiRequest.call(this, '/label', 'GET');
				} catch (err) {
					throw new Error(`Jira Error: ${err}`);
				}
				for (const label of labels.values) {
					const labelName = label;
					const labelId = label;

					returnData.push({
						name: labelName,
						value: labelId,
					});
				}
				return returnData;
			},

			// Get all the priorities to display them to user so that he can
			// select them easily
			async getPriorities(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				let priorities;
				try {
					priorities = await jiraSoftwareCloudApiRequest.call(this, '/priority', 'GET');
				} catch (err) {
					throw new Error(`Jira Error: ${err}`);
				}
				for (const priority of priorities) {
					const priorityName = priority.name;
					const priorityId = priority.id;

					returnData.push({
						name: priorityName,
						value: priorityId,
					});
				}
				return returnData;
			},

			// Get all the users to display them to user so that he can
			// select them easily
			async getUsers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				let users;
				try {
					users = await jiraSoftwareCloudApiRequest.call(this, '/users/search', 'GET');
				} catch (err) {
					throw new Error(`Jira Error: ${err}`);
				}
				for (const user of users) {
					const userName = user.displayName;
					const userId = user.accountId;

					returnData.push({
						name: userName,
						value: userId,
					});
				}
				return returnData;
			},

			// Get all the groups to display them to user so that he can
			// select them easily
			async getGroups(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				let groups;
				try {
					groups = await jiraSoftwareCloudApiRequest.call(this, '/groups/picker', 'GET');
				} catch (err) {
					throw new Error(`Jira Error: ${err}`);
				}
				for (const group of groups.groups) {
					const groupName = group.name;
					const groupId = group.name;

					returnData.push({
						name: groupName,
						value: groupId,
					});
				}
				return returnData;
			}
		}
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const length = items.length as unknown as number;
		let responseData;
		const qs: IDataObject = {};

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < length; i++) {
			if (resource === 'issue') {
				//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-post
				if (operation === 'create') {
					const summary = this.getNodeParameter('summary', i) as string;
					const projectId = this.getNodeParameter('project', i) as string;
					const issueTypeId = this.getNodeParameter('issueType', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
					const body: IIssue = {};
					const fields: IFields = {
						summary,
						project: {
							id: projectId,
						},
						issuetype: {
							id: issueTypeId,
						},
					};
					if (additionalFields.labels) {
						fields.labels = additionalFields.labels as string[];
					}
					if (additionalFields.priority) {
						fields.priority = {
							id: additionalFields.priority as string,
						};
					}
					if (additionalFields.assignee) {
						fields.assignee = {
							id: additionalFields.assignee as string,
						};
					}
					if (additionalFields.description) {
						fields.description = additionalFields.description as string;
					}
					if (additionalFields.updateHistory) {
						qs.updateHistory = additionalFields.updateHistory as boolean;
					}
					const issueTypes = await jiraSoftwareCloudApiRequest.call(this, '/issuetype', 'GET', body, qs);
					const subtaskIssues = [];
					for (const issueType of issueTypes) {
						if (issueType.subtask) {
							subtaskIssues.push(issueType.id);
						}
					}
					if (!additionalFields.parentIssueKey
						&& subtaskIssues.includes(issueTypeId)) {
						throw new Error('You must define a Parent Issue Key when Issue type is sub-task');

					} else if (additionalFields.parentIssueKey
						&& subtaskIssues.includes(issueTypeId)) {
						fields.parent = {
							key: (additionalFields.parentIssueKey as string).toUpperCase(),
						};
					}
					body.fields = fields;
					try {
						responseData = await jiraSoftwareCloudApiRequest.call(this, '/issue', 'POST', body);
					} catch (err) {
						throw new Error(`Jira Error: ${JSON.stringify(err)}`);
					}
				}
				//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-issueIdOrKey-put
				if (operation === 'update') {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
					const body: IIssue = {};
					const fields: IFields = {};
					if (updateFields.summary) {
						fields.summary = updateFields.summary as string;
					}
					if (updateFields.issueType) {
						fields.issuetype = {
							id: updateFields.issueType as string,
						};
					}
					if (updateFields.labels) {
						fields.labels = updateFields.labels as string[];
					}
					if (updateFields.priority) {
						fields.priority = {
							id: updateFields.priority as string,
						};
					}
					if (updateFields.assignee) {
						fields.assignee = {
							id: updateFields.assignee as string,
						};
					}
					if (updateFields.description) {
						fields.description = updateFields.description as string;
					}
					const issueTypes = await jiraSoftwareCloudApiRequest.call(this, '/issuetype', 'GET', body);
					const subtaskIssues = [];
					for (const issueType of issueTypes) {
						if (issueType.subtask) {
							subtaskIssues.push(issueType.id);
						}
					}
					if (!updateFields.parentIssueKey
						&& subtaskIssues.includes(updateFields.issueType)) {
						throw new Error('You must define a Parent Issue Key when Issue type is sub-task');

					} else if (updateFields.parentIssueKey
						&& subtaskIssues.includes(updateFields.issueType)) {
						fields.parent = {
							key: (updateFields.parentIssueKey as string).toUpperCase(),
						};
					}
					body.fields = fields;
					try {
						responseData = await jiraSoftwareCloudApiRequest.call(this, `/issue/${issueKey}`, 'PUT', body);
					} catch (err) {
						throw new Error(`Jira Error: ${JSON.stringify(err)}`);
					}
				}
				//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-issueIdOrKey-get
				if (operation === 'get') {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
					if (additionalFields.fields) {
						qs.fields = additionalFields.fields as string;
					}
					if (additionalFields.fieldsByKey) {
						qs.fieldsByKey = additionalFields.fieldsByKey as boolean;
					}
					if (additionalFields.expand) {
						qs.expand = additionalFields.expand as string;
					}
					if (additionalFields.properties) {
						qs.properties = additionalFields.properties as string;
					}
					if (additionalFields.updateHistory) {
						qs.updateHistory = additionalFields.updateHistory as string;
					}
					try {
						responseData = await jiraSoftwareCloudApiRequest.call(this, `/issue/${issueKey}`, 'GET', {}, qs);
					} catch (err) {
						throw new Error(`Jira Error: ${JSON.stringify(err)}`);
					}
				}
				//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-search-post
				if (operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const options = this.getNodeParameter('options', i) as IDataObject;
					const body: IDataObject = {};
					if (options.fields) {
						body.fields = (options.fields as string).split(',') as string[];
					}
					if (options.jql) {
						body.jql = options.jql as string;
					}
					if (options.expand) {
						body.expand = options.expand as string;
					}
					if (returnAll) {
						responseData = await jiraSoftwareCloudApiRequestAllItems.call(this, 'issues', `/search`, 'POST', body);
					} else {
						const limit = this.getNodeParameter('limit', i) as number;
						body.maxResults = limit;
						responseData = await jiraSoftwareCloudApiRequest.call(this, `/search`, 'POST', body);
						responseData = responseData.issues;
					}
				}
				//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-issueIdOrKey-changelog-get
				if (operation === 'changelog') {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					try {
						if (returnAll) {
							responseData = await jiraSoftwareCloudApiRequestAllItems.call(this, 'values',`/issue/${issueKey}/changelog`, 'GET');
						} else {
							qs.maxResults = this.getNodeParameter('limit', i) as number;
							responseData = await jiraSoftwareCloudApiRequest.call(this, `/issue/${issueKey}/changelog`, 'GET', {}, qs);
							responseData = responseData.values;
						}
					} catch (err) {
						throw new Error(`Jira Error: ${JSON.stringify(err)}`);
					}
				}
				//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-issueIdOrKey-notify-post
				if (operation === 'notify') {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
					const jsonActive = this.getNodeParameter('jsonParameters', 0) as boolean;
					const body: INotify = {};
					if (additionalFields.textBody) {
						body.textBody = additionalFields.textBody as string;
					}
					if (additionalFields.htmlBody) {
						body.htmlBody = additionalFields.htmlBody as string;
					}
					if (!jsonActive) {
						const notificationRecipientsValues = (this.getNodeParameter('notificationRecipientsUi', i) as IDataObject).notificationRecipientsValues as IDataObject[];
						const notificationRecipients: INotificationRecipients = {};
						if (notificationRecipientsValues) {
							// @ts-ignore
							if (notificationRecipientsValues.reporter) {
								// @ts-ignore
								notificationRecipients.reporter = notificationRecipientsValues.reporter as boolean;
							}
							// @ts-ignore
							if (notificationRecipientsValues.assignee) {
								// @ts-ignore
								notificationRecipients.assignee = notificationRecipientsValues.assignee as boolean;
							}
							// @ts-ignore
							if (notificationRecipientsValues.assignee) {
								// @ts-ignore
								notificationRecipients.watchers = notificationRecipientsValues.watchers as boolean;
							}
							// @ts-ignore
							if (notificationRecipientsValues.voters) {
								// @ts-ignore
								notificationRecipients.watchers = notificationRecipientsValues.voters as boolean;
							}
							// @ts-ignore
							if (notificationRecipientsValues.users.length > 0) {
								// @ts-ignore
								notificationRecipients.users = notificationRecipientsValues.users.map(user => {
									return {
										accountId: user
									};
								});
							}
							// @ts-ignore
							if (notificationRecipientsValues.groups.length > 0) {
								// @ts-ignore
								notificationRecipients.groups = notificationRecipientsValues.groups.map(group => {
									return {
										name: group
									};
								});
							}
						}
						body.to = notificationRecipients;
						const notificationRecipientsRestrictionsValues = (this.getNodeParameter('notificationRecipientsRestrictionsUi', i) as IDataObject).notificationRecipientsRestrictionsValues as IDataObject[];
						const notificationRecipientsRestrictions: NotificationRecipientsRestrictions = {};
						if (notificationRecipientsRestrictionsValues) {
							// @ts-ignore
							if (notificationRecipientsRestrictionsValues.groups. length > 0) {
								// @ts-ignore
								notificationRecipientsRestrictions.groups = notificationRecipientsRestrictionsValues.groups.map(group => {
									return {
										name: group
									};
								});
							}
						}
						body.restrict = notificationRecipientsRestrictions;
					} else {
						const notificationRecipientsJson = validateJSON(this.getNodeParameter('notificationRecipientsJson', i) as string);
						if (notificationRecipientsJson) {
							body.to = notificationRecipientsJson;
						}
						const notificationRecipientsRestrictionsJson = validateJSON(this.getNodeParameter('notificationRecipientsRestrictionsJson', i) as string);
						if (notificationRecipientsRestrictionsJson) {
							body.restrict = notificationRecipientsRestrictionsJson;
						}
					}
					try {
						responseData = await jiraSoftwareCloudApiRequest.call(this, `/issue/${issueKey}/notify`, 'POST', body, qs);
					} catch (err) {
						throw new Error(`Jira Error: ${JSON.stringify(err)}`);
					}
				}
				//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-issueIdOrKey-transitions-get
				if (operation === 'transitions') {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
					if (additionalFields.transitionId) {
						qs.transitionId = additionalFields.transitionId as string;
					}
					if (additionalFields.expand) {
						qs.expand = additionalFields.expand as string;
					}
					if (additionalFields.skipRemoteOnlyCondition) {
						qs.skipRemoteOnlyCondition = additionalFields.skipRemoteOnlyCondition as boolean;
					}
					try {
						responseData = await jiraSoftwareCloudApiRequest.call(this, `/issue/${issueKey}/transitions`, 'GET', {}, qs);
						responseData = responseData.transitions;
					} catch (err) {
						throw new Error(`Jira Error: ${JSON.stringify(err)}`);
					}
				}
				//https://developer.atlassian.com/cloud/jira/platform/rest/v2/#api-rest-api-2-issue-issueIdOrKey-delete
				if (operation === 'delete') {
					const issueKey = this.getNodeParameter('issueKey', i) as string;
					const deleteSubtasks = this.getNodeParameter('deleteSubtasks', i) as boolean;
					qs.deleteSubtasks = deleteSubtasks;
					try {
						responseData = await jiraSoftwareCloudApiRequest.call(this, `/issue/${issueKey}`, 'DELETE', {}, qs);
					} catch (err) {
						throw new Error(`Jira Error: ${JSON.stringify(err)}`);
					}
				}
			}
			if (Array.isArray(responseData)) {
				returnData.push.apply(returnData, responseData as IDataObject[]);
			} else {
				returnData.push(responseData as IDataObject);
			}
		}
		return [this.helpers.returnJsonArray(returnData)];
	}
}
