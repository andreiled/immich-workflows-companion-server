# Companion service for Immich Workflows
REST endpoints implementing custom Immich library operations for use in Immich Workflows.

## Supported operations

### Archive raw photos once developed

This is intended to help raw shooters with the following:
1.  See and cull raw photos in Immich before developing them.
1.  'Replace' raw photos with developed images.

This operation works roughly as follows:
1.  When it's called for a raw photo asset which was already developed, it archives the raw photo asset
    (which hides that asset from the timeline without actually removing it anywhere else).
1.  When it's called for a JPEG file, it looks for the original raw photo asset and archives it.
    Additionally, if the found raw photo asset is a part of a series of photos (based on the original file path), then the operation archives all photos in the series.

## Getting started

### 1. Configure the server
1.  Clone the repository.

    -   Run the following command in the directory containing the `docker-compose.yaml` configuration file for Immich.

        ```bash
        git clone git@github.com:andreiled/immich-workflows-companion-server.git workflows-companion-server
        ```

    -   _[Advanced]_ If like me you are tracking all your services configuration using Git (i.e. the directory containing the `docker-compose.yaml` file is already a part of a Git repository),
        then run the following command from the same directory instead:

        ```bash
        git submodule add git@github.com:andreiled/immich-workflows-companion-server.git workflows-companion-server
        ```

1.  Make the following changes to the `docker-compose.yaml` file (the same file that defines all services and resources for Immich):

    1.  Add the following to the very end:

        ```yaml
        configs:
          workflows_companion_users:
            file: ./workflows-companion-server-users.json
        ```

    1.  Add the following to the end of the `services` section:

        ```yaml
        workflows-companion-server:
          container_name: immich_workflows_companion_server
          build: workflows-companion-server
          environment:
            LOG_LEVEL: info
          configs:
            - workflows_companion_users
          restart: always
        ```

1.  Create a new `workflows-companion-server-users.json` file in the same directory (i.e. where the `docker-compose.yaml` file is)
    with the following content:

    ```json
    [
        {"userId": "xxx", "apiKey": "xxx"}
    ]
    ```

    Repeat the `{ ... }` part (separated by a comma) for each user.
    1.  To see the user id in Immich, navigate to _Account Settings > Account_.
    1.  Create a new API key for each user with the following permissions: `asset.read`, `asset.update`.

### 2. Configure workflow(s) in Immich

#### Archive raw photos once developed

```json
{
  "name": "Archive raw photos once developed",
  "description": null,
  "enabled": true,
  "trigger": "AssetCreate",
  "steps": [
    {
      "method": "immich-plugin-core#assetTypeFilter",
      "config": {
        "allowedTypes": [
          "IMAGE"
        ]
      },
      "enabled": true,
      "id": "id-31"
    },
    {
      "method": "immich-plugin-core#webhook",
      "config": {
        "url": "http://immich_workflows_companion_server/",
        "method": "POST"
      },
      "enabled": true,
      "id": "id-32"
    }
  ]
}
```

## Development tips

1.  Use `./npm-wrapper.sh install ...` instead of `npm install ...` if you are working on a machine
    where you cannot or do not want to install dependencies such as NodeJS locally.
