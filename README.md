# WXYC Card Catalog, Revised

[See the site in action here!](https://dj.wxyc.org)


## Description
The WXYC Card Catalog, Revised is a React-based revision of the original WXYC card catalog and flowsheet. This repository showcases an improved version of the existing catalog and flowsheet, while maintaining the classic theme and preserving the original look. Notably, the revised version is optimized for performance, resulting in faster loading times.

## Features
- Retains the classic theme: The revised version of the WXYC Card Catalog doesn't modify the old look in any way. Users will still experience the familiar aesthetics they are accustomed to.
- Classic theme views: All views within the application that utilize the classic theme are prepended with `CLASSIC_`. This helps users distinguish between the classic and updated versions of the application.
- New theme: With updated components and views, a faster and more seamless workflow between the flowsheet and card catalog is possible.
- Mail Bin: a digital mail bin is available on every account, so DJs can add to the flowsheet directly from their bin without having to type during their sets.

## Deployment
Is handled by github actions.

## API Integration
The revised catalog leverages services defined in `api-service.js`, which utilizes the popular Axios library to communicate with an AWS API Gateway. This integration allows seamless communication between the front-end application and the API endpoints, enabling data retrieval and manipulation.

## Technologies Used
- React: The front-end framework used for building the revised WXYC Card Catalog.
- MUI Joy UI: A library of pre-built UI components for React that allows fast and beautiful feature development.
- Github Pages: For hosting the frontend and automating publication.
- Axios: A JavaScript library used for making HTTP requests to the AWS API Gateway.

## Installation and Setup
1. Clone the repository: `git clone https://github.com/WXYC/dj-site.git`
2. Navigate to the project directory: `cd dj-site`
3. Install dependencies: `npm install`
4. Run the application: `npm run dev`
5. Access the application locally: Open your web browser and visit `http://localhost:3000`

## Contributing
Contributions to the WXYC Card Catalog, Revised are welcome! If you would like to contribute, please follow these steps:
1. Create a new branch: `git checkout -b my-feature-branch`
2. Make your changes and commit them: `git commit -m "Add some feature"`
3. Test your build: `npm run build`
4. Push to the branch: `git push origin my-feature-branch`
5. Submit a pull request detailing your changes.
6. When your pull request is approved, Github Actions will auto-deploy your changes to the site. Be sure to give 5-10 minutes after the build completes for the changes to propagate.

## License
The WXYC Card Catalog, Revised is released under the [MIT License](LICENSE). Feel free to use, modify, and distribute the code as per the terms of this license.

## Acknowledgments
We would like to express our gratitude to the contributors and maintainers of the original WXYC Card Catalog for their valuable work, which served as the foundation for this revised version. In particular, Tim Ross/Tubafrenzy, who developed the original flowsheet site and maintained the database for years during decades when it was much more difficult to maintain and develop a site like this one.
