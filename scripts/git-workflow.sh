#!/bin/bash

# Git Workflow Helper Script untuk Unnet Web Automation
# Usage: ./scripts/git-workflow.sh [command] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Function to create feature branch
create_feature() {
    if [ -z "$1" ]; then
        print_error "Feature name required. Usage: ./git-workflow.sh feature <feature-name>"
        exit 1
    fi
    
    local feature_name="$1"
    local branch_name="feature/$feature_name"
    
    print_header "Creating Feature Branch"
    print_status "Switching to develop branch..."
    git checkout develop
    git pull origin develop
    
    print_status "Creating feature branch: $branch_name"
    git checkout -b "$branch_name"
    
    print_status "Feature branch '$branch_name' created successfully!"
    print_warning "Remember to commit your changes and push when ready:"
    echo "  git add ."
    echo "  git commit -m \"feat($feature_name): description of your feature\""
    echo "  git push -u origin $branch_name"
}

# Function to create bugfix branch
create_bugfix() {
    if [ -z "$1" ]; then
        print_error "Bugfix name required. Usage: ./git-workflow.sh bugfix <bugfix-name>"
        exit 1
    fi
    
    local bugfix_name="$1"
    local branch_name="bugfix/$bugfix_name"
    
    print_header "Creating Bugfix Branch"
    print_status "Switching to develop branch..."
    git checkout develop
    git pull origin develop
    
    print_status "Creating bugfix branch: $branch_name"
    git checkout -b "$branch_name"
    
    print_status "Bugfix branch '$branch_name' created successfully!"
    print_warning "Remember to commit your changes and push when ready:"
    echo "  git add ."
    echo "  git commit -m \"fix($bugfix_name): description of your fix\""
    echo "  git push -u origin $branch_name"
}

# Function to finish feature/bugfix
finish_branch() {
    local current_branch=$(git branch --show-current)
    
    if [[ "$current_branch" == "main" || "$current_branch" == "develop" ]]; then
        print_error "Cannot finish main or develop branch!"
        exit 1
    fi
    
    print_header "Finishing Branch: $current_branch"
    
    print_status "Pushing final changes..."
    git push origin "$current_branch"
    
    print_status "Switching to develop branch..."
    git checkout develop
    git pull origin develop
    
    print_status "Merging $current_branch into develop..."
    git merge "$current_branch" --no-ff -m "Merge $current_branch into develop"
    
    print_status "Pushing develop branch..."
    git push origin develop
    
    print_warning "Branch $current_branch merged successfully!"
    print_warning "You can now delete the branch:"
    echo "  git branch -d $current_branch"
    echo "  git push origin --delete $current_branch"
}

# Function to show current status
show_status() {
    print_header "Git Status"
    git status --short
    echo ""
    
    print_header "Current Branch"
    git branch --show-current
    echo ""
    
    print_header "Recent Commits"
    git log --oneline -5
}

# Function to show help
show_help() {
    echo "Git Workflow Helper untuk Unnet Web Automation"
    echo ""
    echo "Usage: ./scripts/git-workflow.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  feature <name>     Create new feature branch"
    echo "  bugfix <name>      Create new bugfix branch"
    echo "  finish             Finish current branch (merge to develop)"
    echo "  status             Show current git status"
    echo "  help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/git-workflow.sh feature dashboard-realtime"
    echo "  ./scripts/git-workflow.sh bugfix auth-jwt-error"
    echo "  ./scripts/git-workflow.sh finish"
    echo "  ./scripts/git-workflow.sh status"
}

# Main script logic
case "$1" in
    "feature")
        create_feature "$2"
        ;;
    "bugfix")
        create_bugfix "$2"
        ;;
    "finish")
        finish_branch
        ;;
    "status")
        show_status
        ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
