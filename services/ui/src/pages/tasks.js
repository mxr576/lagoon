import React from 'react';
import * as R from 'ramda';
import { withRouter } from 'next/router';
import Head from 'next/head';
import getConfig from 'next/config';
import { Query } from 'react-apollo';
import MainLayout from 'layouts/MainLayout';
import EnvironmentWithTasksQuery from 'lib/query/EnvironmentWithTasks';
import TasksSubscription from 'lib/subscription/Tasks';
import Breadcrumbs from 'components/Breadcrumbs';
import ProjectBreadcrumb from 'components/Breadcrumbs/Project';
import EnvironmentBreadcrumb from 'components/Breadcrumbs/Environment';
import NavTabs from 'components/NavTabs';
import AddTask from 'components/AddTask';
import Tasks from 'components/Tasks';
import withQueryLoading from 'lib/withQueryLoading';
import withQueryError from 'lib/withQueryError';
import { withEnvironmentRequired } from 'lib/withDataRequired';
import { bp } from 'lib/variables';

const { publicRuntimeConfig } = getConfig();
const envLimit = parseInt(publicRuntimeConfig.LAGOON_UI_TASKS_LIMIT, 10);
const tasksLimit = envLimit === -1 ? null : envLimit;

/**
 * Displays the tasks page, given the openshift project name.
 */
export const PageTasks = ({ router }) => (
  <>
    <Head>
      <title>{`${router.query.openshiftProjectName} | Tasks`}</title>
    </Head>
    <Query
      query={EnvironmentWithTasksQuery}
      variables={{
        openshiftProjectName: router.query.openshiftProjectName,
        limit: tasksLimit
      }}
    >
      {R.compose(
        withQueryLoading,
        withQueryError,
        withEnvironmentRequired
      )(({ data: { environment }, subscribeToMore }) => {
        subscribeToMore({
          document: TasksSubscription,
          variables: { environment: environment.id },
          updateQuery: (prevStore, { subscriptionData }) => {
            if (!subscriptionData.data) return prevStore;
            const prevTasks = prevStore.environment.tasks;
            const incomingTask = subscriptionData.data.taskChanged;
            const existingIndex = prevTasks.findIndex(
              prevTask => prevTask.id === incomingTask.id
            );
            let newTasks;

            // New task.
            if (existingIndex === -1) {
              newTasks = [incomingTask, ...prevTasks];
            }
            // Updated task
            else {
              newTasks = Object.assign([...prevTasks], {
                [existingIndex]: incomingTask
              });
            }

            const newStore = {
              ...prevStore,
              environment: {
                ...prevStore.environment,
                tasks: newTasks
              }
            };

            return newStore;
          }
        });

        return (
          <MainLayout>
            <Breadcrumbs>
              <ProjectBreadcrumb projectSlug={environment.project.name} />
              <EnvironmentBreadcrumb
                environmentSlug={environment.openshiftProjectName}
                projectSlug={environment.project.name}
              />
            </Breadcrumbs>
            <div className="content-wrapper">
              <NavTabs activeTab="tasks" environment={environment} />
              <div className="content">
                <AddTask pageEnvironment={environment} />
                <Tasks
                  tasks={environment.tasks}
                  environmentSlug={environment.openshiftProjectName}
                  projectSlug={environment.project.name}
                />
              </div>
            </div>
            <style jsx>{`
              .content-wrapper {
                @media ${bp.tabletUp} {
                  display: flex;
                  padding: 0;
                }
              }

              .content {
                padding: 32px calc((100vw / 16) * 1);
                width: 100%;
              }
            `}</style>
          </MainLayout>
        );
      })}
    </Query>
  </>
);

export default withRouter(PageTasks);
