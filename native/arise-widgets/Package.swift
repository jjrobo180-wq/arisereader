// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AriseWidgets",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "AriseWidgets", targets: ["AriseWidgetsPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "AriseWidgetsPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/AriseWidgetsPlugin"
        )
    ]
)
