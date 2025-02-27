/**
 * Copyright 2013-2021 the original author or authors from the JHipster project.
 *
 * This file is part of the JHipster project, see https://www.jhipster.tech/
 * for more information.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const fs = require('fs');
const exec = require('child_process').exec;
const chalk = require('chalk');
const BaseBlueprintGenerator = require('../generator-base-blueprint');
const {
  INITIALIZING_PRIORITY,
  PROMPTING_PRIORITY,
  CONFIGURING_PRIORITY,
  LOADING_PRIORITY,
  DEFAULT_PRIORITY,
  WRITING_PRIORITY,
  END_PRIORITY,
} = require('../../lib/constants/priorities.cjs').compat;

const statistics = require('../statistics');

const constants = require('../generator-constants');

const cacheTypes = require('../../jdl/jhipster/cache-types');
const { MEMCACHED } = require('../../jdl/jhipster/cache-types');

const NO_CACHE_PROVIDER = cacheTypes.NO;

const { MAVEN } = require('../../jdl/jhipster/build-tool-types');
const { GENERATOR_AZURE_SPRING_CLOUD } = require('../generator-list');

/* eslint-disable consistent-return */
module.exports = class extends BaseBlueprintGenerator {
  constructor(args, options, features) {
    super(args, options, features);

    this.option('skip-build', {
      desc: 'Skips building the application',
      type: Boolean,
      defaults: false,
    });

    this.option('skip-deploy', {
      desc: 'Skips deployment to Azure Spring Cloud',
      type: Boolean,
      defaults: false,
    });

    this.azureSpringCloudSkipBuild = this.options.skipBuild;
    this.azureSpringCloudSkipDeploy = this.options.skipDeploy || this.options.skipBuild;
  }

  async _postConstruct() {
    if (!this.fromBlueprint) {
      await this.composeWithBlueprints(GENERATOR_AZURE_SPRING_CLOUD);
    }
  }

  _initializing() {
    return {
      sayHello() {
        if (!this.options.fromCli) {
          this.warning(
            `Deprecated: JHipster seems to be invoked using Yeoman command. Please use the JHipster CLI. Run ${chalk.red(
              'jhipster <command>'
            )} instead of ${chalk.red('yo jhipster:<command>')}`
          );
        }
        this.log(chalk.bold('Azure Spring Cloud configuration is starting'));
      },
      getSharedConfig() {
        this.loadAppConfig();
        this.loadServerConfig();
        this.loadPlatformConfig();
      },
      getConfig() {
        this.env.options.appPath = this.config.get('appPath') || constants.CLIENT_MAIN_SRC_DIR;
        this.cacheProvider = this.cacheProvider || NO_CACHE_PROVIDER;
        this.enableHibernateCache = this.enableHibernateCache && ![NO_CACHE_PROVIDER, MEMCACHED].includes(this.cacheProvider);
        this.frontendAppName = this.getFrontendAppName();
        this.azureSpringCloudResourceGroupName = ''; // This is not saved, as it is better to get the Azure default variable
        this.azureSpringCloudServiceName = ''; // This is not saved, as it is better to get the Azure default variable
        this.azureSpringCloudAppName = this.config.get('azureSpringCloudAppName');
        this.azureSpringCloudDeploymentType = this.config.get('azureSpringCloudDeploymentType');
      },
      loadConstants() {
        this.JAVA_VERSION = constants.JAVA_VERSION;
      },
    };
  }

  get [INITIALIZING_PRIORITY]() {
    if (this.delegateToBlueprint) return {};
    return this._initializing();
  }

  _prompting() {
    return {
      checkBuildTool() {
        if (this.abort) return;
        const done = this.async();
        if (this.buildTool !== MAVEN) {
          this.log.error('Sorry, this sub-generator only works with Maven projects for the moment.');
          this.abort = true;
        }
        done();
      },

      checkInstallation() {
        if (this.abort) return;
        const done = this.async();

        exec('az --version', err => {
          if (err) {
            this.log.error(
              `You don't have the Azure CLI installed.
Download it from:
${chalk.red('https://docs.microsoft.com/en-us/cli/azure/install-azure-cli/?WT.mc_id=generator-jhipster-judubois')}`
            );
            this.abort = true;
          }
          done();
        });
      },

      checkExtensionInstallation() {
        if (this.abort) return;
        const done = this.async();

        exec('az extension show --name spring-cloud', err => {
          if (err) {
            this.log.error(
              `You don't have the Azure Spring Cloud extension installed in your Azure CLI.
Install it by running:
${chalk.red('az extension add --name spring-cloud')}`
            );
            this.abort = true;
          }
          done();
        });
      },

      checkClusterAvailability() {
        if (this.abort) return;
        const done = this.async();

        exec('az spring-cloud app list', err => {
          if (err) {
            this.log.error(`${chalk.red('Your Azure Spring Cloud cluster is not available!')}\n ${err}`);
            this.abort = true;
          }
          done();
        });
      },

      getAzureSpringCloudDefaults() {
        if (this.abort) return;
        const done = this.async();
        exec('az configure --list-defaults true', (err, stdout) => {
          if (err) {
            this.config.set({
              azureSpringCloudResourceGroupName: null,
            });
            this.abort = true;
            this.log.error('Could not retrieve your Azure default configuration.');
          } else {
            const json = JSON.parse(stdout);
            Object.keys(json).forEach(key => {
              if (json[key].name === 'group') {
                this.azureSpringCloudResourceGroupName = json[key].value;
              }
              if (json[key].name === 'spring-cloud') {
                this.azureSpringCloudServiceName = json[key].value;
              }
            });
            if (this.azureSpringCloudResourceGroupName === '') {
              this.log.info(
                `Your default Azure resource group is not set up. We recommend doing it using the command
                                '${chalk.yellow('az configure --defaults group=<resource group name>')}`
              );
              this.azureSpringCloudResourceGroupName = '';
            }
            if (this.azureSpringCloudServiceName === '') {
              this.log.info(
                `Your default Azure Spring Cloud service name is not set up. We recommend doing it using the command
                                '${chalk.yellow('az configure --defaults spring-cloud=<service instance name>')}`
              );
              this.azureSpringCloudServiceName = '';
            }
          }
          done();
        });
      },

      askForazureSpringCloudVariables() {
        if (this.abort) return;
        const done = this.async();

        const prompts = [
          {
            type: 'input',
            name: 'azureSpringCloudResourceGroupName',
            message: 'Azure resource group name:',
            default: this.azureSpringCloudResourceGroupName,
          },
          {
            type: 'input',
            name: 'azureSpringCloudServiceName',
            message: 'Azure Spring Cloud service name (the name of your cluster):',
            default: this.azureSpringCloudServiceName,
          },
          {
            type: 'input',
            name: 'azureSpringCloudAppName',
            message: 'Azure Spring Cloud application name:',
            default: this.azureSpringCloudAppName || this.baseName,
          },
        ];

        this.prompt(prompts).then(props => {
          this.azureSpringCloudResourceGroupName = props.azureSpringCloudResourceGroupName;
          this.azureSpringCloudServiceName = props.azureSpringCloudServiceName;
          this.azureSpringCloudAppName = props.azureSpringCloudAppName;
          done();
        });
      },

      askForAzureDeployType() {
        if (this.abort) return;
        const done = this.async();
        const prompts = [
          {
            type: 'list',
            name: 'azureSpringCloudDeploymentType',
            message: 'Which type of deployment do you want ?',
            choices: [
              {
                value: 'local',
                name: 'Build and deploy locally',
              },
              {
                value: 'github-action',
                name: 'Build and deploy using GitHub Actions',
              },
            ],
            default: 0,
          },
        ];

        this.prompt(prompts).then(props => {
          this.azureSpringCloudDeploymentType = props.azureSpringCloudDeploymentType;
          done();
        });
      },
    };
  }

  get [PROMPTING_PRIORITY]() {
    if (this.delegateToBlueprint) return {};
    return this._prompting();
  }

  _configuring() {
    return {
      saveConfig() {
        if (this.abort) return;
        this.config.set({
          azureSpringCloudAppName: this.azureSpringCloudAppName,
          azureSpringCloudDeploymentType: this.azureSpringCloudDeploymentType,
        });
      },
    };
  }

  get [CONFIGURING_PRIORITY]() {
    if (this.delegateToBlueprint) return {};
    return this._configuring();
  }

  _default() {
    return {
      insight() {
        statistics.sendSubGenEvent('generator', GENERATOR_AZURE_SPRING_CLOUD);
      },

      azureSpringCloudAppCreate() {
        if (this.abort) return;
        const done = this.async();
        exec(
          `az spring-cloud app show --resource-group ${this.azureSpringCloudResourceGroupName} \
--service ${this.azureSpringCloudServiceName} --name ${this.azureSpringCloudAppName}`,
          (err, stdout) => {
            if (err) {
              this.log(chalk.bold('Application does not exist yet, creating it...'));
              exec(
                `az spring-cloud app create --resource-group ${this.azureSpringCloudResourceGroupName} \
            --service ${this.azureSpringCloudServiceName} --name ${this.azureSpringCloudAppName}`,
                (err, stdout) => {
                  if (err) {
                    this.abort = true;
                    this.log.error(`Application creation failed! Here is the error: ${err}`);
                  } else {
                    this.log(`${chalk.green(chalk.bold('Success!'))} Your application has been created.`);
                  }
                  done();
                }
              );
            } else {
              this.log(chalk.bold('Application already exists, using it.'));
              done();
            }
          }
        );
      },
    };
  }

  get [DEFAULT_PRIORITY]() {
    if (this.delegateToBlueprint) return {};
    return this._default();
  }

  _loading() {
    return {
      derivedProperties() {
        this.isPackageNameJhipsterTech = this.packageName !== 'tech.jhipster';
        this.loadDerivedServerConfig();
        this.loadDerivedPlatformConfig();
        this.loadDerivedAppConfig();
      },
    };
  }

  get [LOADING_PRIORITY]() {
    if (this.delegateToBlueprint) return {};
    return this._loading();
  }

  _writing() {
    return {
      copyAzureSpringCloudFiles() {
        if (this.abort) return;
        this.log(chalk.bold('\nCreating Azure Spring Cloud deployment files'));
        this.template('application-azure.yml.ejs', `${constants.SERVER_MAIN_RES_DIR}/config/application-azure.yml`);
        this.template('bootstrap-azure.yml.ejs', `${constants.SERVER_MAIN_RES_DIR}/config/bootstrap-azure.yml`);
        if (this.azureSpringCloudDeploymentType === 'github-action') {
          this.template('github/workflows/azure-spring-cloud.yml.ejs', '.github/workflows/azure-spring-cloud.yml');
        }
      },

      addAzureSpringCloudMavenProfile() {
        if (this.abort) return;
        if (this.buildTool === MAVEN) {
          this.render('pom-profile.xml.ejs', profile => {
            this.addMavenProfile('azure', `            ${profile.toString().trim()}`);
          });
        }
      },
    };
  }

  get [WRITING_PRIORITY]() {
    if (this.delegateToBlueprint) return {};
    return this._writing();
  }

  _end() {
    return {
      gitHubAction() {
        if (this.abort) return;
        if (this.azureSpringCloudDeploymentType === 'local') return;
        const done = this.async();

        try {
          this.log('Test if Git is configured on your project...');
          fs.lstatSync('.git');
          this.log(chalk.bold('\nUsing existing Git repository'));
        } catch (e) {
          // An exception is thrown if the folder doesn't exist
          this.log.error(
            `${chalk.red('Git is not set up on your project!')}
You need a GitHub project correctly configured in order to use GitHub Actions.`
          );
          this.abort = true;
          return;
        }
        const gitAddCmd = 'git add .';
        this.log(chalk.bold('\nAdding Azure Spring Cloud files to the Git repository'));
        this.log(chalk.cyan(gitAddCmd));
        exec(gitAddCmd, (err, stdout, stderr) => {
          if (err) {
            this.abort = true;
            this.log.error(err);
          } else {
            const line = stderr.toString().trimRight();
            if (line.trim().length !== 0) this.log(line);
            this.log(chalk.bold('\nCommitting Azure Spring Cloud files'));
            const gitCommitCmd = 'git commit -m "Add Azure Spring Cloud files with automated GitHub Action deployment" --allow-empty';

            this.log(chalk.cyan(gitCommitCmd));
            exec(gitCommitCmd, (err, stdout, stderr) => {
              if (err) {
                this.abort = true;
                this.log.error(err);
              } else {
                const line = stderr.toString().trimRight();
                if (line.trim().length !== 0) this.log(line);
                this.log(chalk.bold('\nPushing Azure Spring Cloud files'));
                const gitPushCmd = 'git push';
                this.log(chalk.cyan(gitPushCmd));
                exec(gitPushCmd, (err, stdout, stderr) => {
                  if (err) {
                    this.abort = true;
                    this.log.error(err);
                  } else {
                    const line = stderr.toString().trimRight();
                    if (line.trim().length !== 0) this.log(line);
                    this.log(chalk.bold(chalk.green('Congratulations, automated deployment with GitHub Action is set up!')));
                    this.log(
                      `For the deployment to succeed, you will need to configure a ${chalk.bold('AZURE_CREDENTIALS')} secret in GitHub.
Read the documentation at https://github.com/microsoft/azure-spring-cloud-training/blob/master/11-configure-ci-cd/README.md
for more detailed information.`
                    );
                    done();
                  }
                });
              }
            });
          }
        });
      },

      productionBuild() {
        if (this.abort) return;
        if (this.azureSpringCloudDeploymentType === 'github-action') return;
        if (this.azureSpringCloudSkipBuild) return;

        const done = this.async();
        this.log(chalk.bold('\nBuilding application'));

        const child = this.buildApplication(this.buildTool, 'prod,azure', false, err => {
          if (err) {
            this.abort = true;
            this.log.error(err);
          }
          done();
        });

        this.buildCmd = child.buildCmd;

        child.stdout.on('data', data => {
          process.stdout.write(data.toString());
        });
      },

      productionDeploy() {
        if (this.abort) return;
        if (this.azureSpringCloudDeploymentType === 'github-action') return;
        if (this.azureSpringCloudSkipDeploy) return;

        const done = this.async();
        this.log(chalk.bold('\nDeploying application...'));
        let buildDir = 'target';
        if (this.buildTool === 'gradle') {
          buildDir = 'build/libs';
        }
        exec(
          `az spring-cloud app deploy --resource-group ${this.azureSpringCloudResourceGroupName} \
--service ${this.azureSpringCloudServiceName} --name ${this.azureSpringCloudAppName} \
--jar-path ${buildDir}/*.jar`,
          (err, stdout) => {
            if (err) {
              this.abort = true;
              this.log.error(`Deployment failed!\n ${err}`);
            } else {
              const json = JSON.parse(stdout);
              this.log(`${chalk.green(chalk.bold('Success!'))} Your application has been deployed.`);
              this.log(`Provisioning state: ${chalk.bold(json.properties.provisioningState)}`);
              this.log(`Application status  : ${chalk.bold(json.properties.status)}`);
            }
            done();
          }
        );
      },
    };
  }

  get [END_PRIORITY]() {
    if (this.delegateToBlueprint) return {};
    return this._end();
  }
};
